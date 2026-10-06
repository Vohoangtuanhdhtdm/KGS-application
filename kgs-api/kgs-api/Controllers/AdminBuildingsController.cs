using System.ComponentModel.DataAnnotations;
using kgs_api.Data;
using kgs_api.Dtos;
using kgs_api.Hubs;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    public sealed record AdminBuildingRowDto(
        Guid AssetId, string Name, string City, string District, string AddressDetail,
        string OwnerId, string OwnerName, string OwnerEmail,
        int Floors, int Units, int VacantUnits, int LiveListings, int PendingListings,
        bool HasModel, bool Published, DateTime CreatedAt);

    public sealed record HideBuildingModelRequest([Required, MaxLength(500)] string Reason);

    /// <summary>Toà nhà và mô hình 3D — góc nhìn quản trị.
    ///
    /// Chủ nhà tự dựng và tự bật "Công khai" cho mô hình 3D; tin đăng thì qua kiểm duyệt còn mô
    /// hình thì không. Màn hình này cho admin thấy mọi toà nhà, mở mô hình ra xem, và GỠ mô hình
    /// khỏi trang công khai khi nó sai (khung lấy nhầm toà bên cạnh, số tầng vô lý…) — kèm lý do
    /// gửi cho chủ nhà. Chủ nhà sửa xong tự bật công khai lại trong xưởng dựng.</summary>
    [ApiController]
    [Authorize(Roles = "Admin")]
    [SignalAdmins]
    [Route("api/admin/buildings")]
    public sealed class AdminBuildingsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly BuildingModelService _models;
        private readonly INotificationSender _notifier;
        private readonly ILogger<AdminBuildingsController> _logger;

        public AdminBuildingsController(
            ApplicationDbContext db, BuildingModelService models, INotificationSender notifier,
            ILogger<AdminBuildingsController> logger)
        {
            _db = db; _models = models; _notifier = notifier; _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<AdminBuildingRowDto>>> List(
            [FromQuery] string? q, [FromQuery] string? model, CancellationToken ct)
        {
            var src = _db.Assets.AsNoTracking().Where(a => a.Units.Any() || a.FootprintJson != null);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var kw = $"%{q.Trim()}%";
                src = src.Where(a => EF.Functions.ILike(a.Name, kw) || EF.Functions.ILike(a.Address.Detail, kw)
                                  || EF.Functions.ILike(a.User.Name, kw) || EF.Functions.ILike(a.User.Email!, kw));
            }
            src = model switch
            {
                "published" => src.Where(a => a.FootprintJson != null && a.BuildingModelPublished),
                "hidden" => src.Where(a => a.FootprintJson != null && !a.BuildingModelPublished),
                "none" => src.Where(a => a.FootprintJson == null),
                _ => src,
            };

            var rows = await src
                .OrderByDescending(a => a.BuildingModelPublished).ThenByDescending(a => a.CreatedAt)
                .Select(a => new AdminBuildingRowDto(
                    a.Id, a.Name, a.Address.City, a.Address.District, a.Address.Detail,
                    a.UserId, a.User.Name, a.User.Email!,
                    Math.Max(a.Floors ?? 0, a.Units.Max(u => (int?)u.FloorNumber) ?? 0),
                    a.Units.Count(),
                    a.Units.Count(u => u.Status == UnitStatus.Vacant),
                    a.Listings.Count(l => l.AssetUnitId != null && l.Status == ListingStatus.Approved),
                    a.Listings.Count(l => l.AssetUnitId != null && l.Status == ListingStatus.Pending),
                    a.FootprintJson != null, a.BuildingModelPublished, a.CreatedAt))
                .ToListAsync(ct);
            return Ok(rows);
        }

        /// <summary>Mô hình của một toà nhà — kể cả khi chưa công khai.</summary>
        [HttpGet("{assetId:guid}")]
        public async Task<ActionResult<BuildingModelDto>> Get(Guid assetId, CancellationToken ct)
            => Ok(await _models.GetForAdminAsync(assetId, ct));

        [HttpPost("{assetId:guid}/hide")]
        public async Task<IActionResult> Hide(Guid assetId, [FromBody] HideBuildingModelRequest req, CancellationToken ct)
        {
            var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy toà nhà.");
            if (!asset.BuildingModelPublished) return NoContent();
            asset.BuildingModelPublished = false;
            await _db.SaveChangesAsync(ct);
            try
            {
                await _notifier.SendAsync(asset.UserId, $"Mô hình 3D đã bị ẩn: {asset.Name}",
                    $"Quản trị viên đã gỡ mô hình 3D của toà nhà khỏi trang công khai. Lý do: {req.Reason.Trim()} " +
                    "Tin đăng của các căn vẫn hiển thị bình thường. Sửa mô hình rồi bật Công khai lại trong xưởng dựng.",
                    $"/toa-nha/{asset.Id}?tab=3d", "Mở xưởng dựng", ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không gửi được thông báo ẩn mô hình cho {AssetId}", asset.Id);
            }
            return NoContent();
        }

        [HttpPost("{assetId:guid}/show")]
        public async Task<IActionResult> Show(Guid assetId, CancellationToken ct)
        {
            var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy toà nhà.");
            if (string.IsNullOrEmpty(asset.FootprintJson))
                throw new ConflictException("Toà nhà chưa có khung 3D — chủ nhà cần dựng mô hình trước.");
            asset.BuildingModelPublished = true;
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
    }
}

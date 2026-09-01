using kgs_api.Data;
using kgs_api.Dtos.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    [ApiController]
    [Authorize(Roles = "Admin")]          // ← chặn ở tầng framework, không cần check thủ công
    [Route("api/admin/properties")]
    public sealed class AdminPropertiesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public AdminPropertiesController(ApplicationDbContext db) => _db = db;

        /// <summary>Danh sách tin đăng chờ duyệt.</summary>
        [HttpGet("pending")]
        public async Task<ActionResult<IReadOnlyList<PendingPropertyDto>>> GetPending(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);

            var items = await _db.Properties.AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Pending)
                .OrderBy(p => p.CreatedAt)                    // tin cũ duyệt trước
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(p => new PendingPropertyDto(
                    p.Id, p.Title, p.Price, p.City, p.District,
                    p.User.Name, p.User.Email!, p.CreatedAt,
                    p.Images.Count))
                .ToListAsync(ct);

            var total = await _db.Properties.CountAsync(p => p.Status == PropertyStatus.Pending, ct);

            return Ok(new { items, page, pageSize, totalCount = total });
        }

        /// <summary>Duyệt tin đăng.</summary>
        [HttpPost("{propertyId:int}/approve")]
        public async Task<IActionResult> Approve(
            int propertyId, [FromBody] ApprovePropertyRequest request, CancellationToken ct)
        {
            var property = await _db.Properties.FirstOrDefaultAsync(p => p.Id == propertyId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (property.Status != PropertyStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {property.Status}, không thể duyệt.");

            property.Status = PropertyStatus.Approved;
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã duyệt tin đăng.", propertyId, status = property.Status.ToString() });
        }

        /// <summary>Từ chối tin đăng (bắt buộc nêu lý do).</summary>
        [HttpPost("{propertyId:int}/reject")]
        public async Task<IActionResult> Reject(
            int propertyId, [FromBody] RejectPropertyRequest request, CancellationToken ct)
        {
            var property = await _db.Properties.FirstOrDefaultAsync(p => p.Id == propertyId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (property.Status != PropertyStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {property.Status}, không thể từ chối.");

            property.Status = PropertyStatus.Rejected;
            await _db.SaveChangesAsync(ct);

            // TODO: gửi email/notification báo lý do từ chối cho chủ tin đăng
            return Ok(new { message = "Đã từ chối tin đăng.", propertyId, reason = request.Reason });
        }

        /// <summary>Thống kê nhanh cho dashboard admin.</summary>
        [HttpGet("stats")]
        public async Task<IActionResult> Stats(CancellationToken ct)
        {
            var stats = await _db.Properties
                .GroupBy(p => p.Status)
                .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
                .ToListAsync(ct);

            return Ok(new
            {
                byStatus = stats,
                totalUsers = await _db.Users.CountAsync(ct),
                totalAssets = await _db.Assets.CountAsync(ct)
            });
        }
    }
}

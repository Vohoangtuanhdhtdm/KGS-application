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
    [Route("api/admin/listings")]
    public sealed class AdminListingsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public AdminListingsController(ApplicationDbContext db) => _db = db;

        /// <summary>Danh sách tin đăng chờ duyệt.</summary>
        [HttpGet("pending")]
        public async Task<IActionResult> GetPending(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);

            var items = await _db.Listings.AsNoTracking()
                .Where(l => l.Status == ListingStatus.Pending)
                .OrderBy(l => l.CreatedAt)                    // tin cũ duyệt trước
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new PendingListingDto(
                    l.Id, l.Title, l.Price,
                    l.Asset.Address.City, l.Asset.Address.District,
                    l.AssetUnit != null ? l.AssetUnit.Name : null,
                    l.Asset.User.Name, l.Asset.User.Email!, l.CreatedAt,
                    l.Images.Count))
                .ToListAsync(ct);

            var total = await _db.Listings.CountAsync(l => l.Status == ListingStatus.Pending, ct);

            return Ok(new { items, page, pageSize, totalCount = total });
        }

        /// <summary>Duyệt tin đăng.</summary>
        [HttpPost("{listingId:guid}/approve")]
        public async Task<IActionResult> Approve(
            Guid listingId, [FromBody] ApproveListingRequest request, CancellationToken ct)
        {
            var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.Status != ListingStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {listing.Status}, không thể duyệt.");

            listing.Status = ListingStatus.Approved;
            listing.ModerationNote = request.Note;

            // Lần duyệt đầu tiên mới đặt PublishedAt — tin bị sửa rồi duyệt lại vẫn giữ
            // ngày lên sóng gốc, nên thứ tự "tin mới nhất" ngoài marketplace không bị xáo.
            listing.PublishedAt ??= DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã duyệt tin đăng.", listingId, status = listing.Status.ToString() });
        }

        /// <summary>Từ chối tin đăng (bắt buộc nêu lý do).</summary>
        [HttpPost("{listingId:guid}/reject")]
        public async Task<IActionResult> Reject(
            Guid listingId, [FromBody] RejectListingRequest request, CancellationToken ct)
        {
            var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.Status != ListingStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {listing.Status}, không thể từ chối.");

            listing.Status = ListingStatus.Rejected;

            // Lý do từ chối nay được LƯU LẠI. Trước đây nó chỉ được echo trong response rồi
            // vứt đi, nên chủ tin không bao giờ biết vì sao tin của mình bị loại.
            listing.ModerationNote = request.Reason;

            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã từ chối tin đăng.", listingId, reason = request.Reason });
        }

        /// <summary>Thống kê nhanh cho dashboard admin.</summary>
        [HttpGet("stats")]
        public async Task<IActionResult> Stats(CancellationToken ct)
        {
            var stats = await _db.Listings
                .GroupBy(l => l.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            return Ok(new
            {
                byStatus = stats.Select(s => new { Status = s.Status.ToString(), s.Count }),
                totalUsers = await _db.Users.CountAsync(ct),
                totalAssets = await _db.Assets.CountAsync(ct)
            });
        }
    }
}

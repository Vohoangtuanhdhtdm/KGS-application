using kgs_api.Data;
using kgs_api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    /// <summary>Chuông thông báo của người đang đăng nhập — chỉ đọc được thông báo của chính mình.</summary>
    [ApiController]
    [Authorize]
    [Route("api/notifications")]
    public sealed class NotificationsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUser;

        public NotificationsController(ApplicationDbContext db, ICurrentUserService currentUser)
        {
            _db = db; _currentUser = currentUser;
        }

        [HttpGet]
        public async Task<ActionResult<NotificationPageDto>> List(
            [FromQuery] bool unreadOnly = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
        {
            pageSize = Math.Clamp(pageSize, 1, 50);
            page = Math.Max(page, 1);
            var mine = _db.Notifications.AsNoTracking().Where(n => n.UserId == _currentUser.UserId);
            var q = unreadOnly ? mine.Where(n => n.ReadAt == null) : mine;

            var total = await q.CountAsync(ct);
            var unread = await mine.CountAsync(n => n.ReadAt == null, ct);
            var items = await q.OrderByDescending(n => n.CreatedAt).ThenBy(n => n.Id)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(n => new NotificationDto(n.Id, n.Title, n.Body, n.LinkPath, n.LinkLabel, n.CreatedAt, n.ReadAt != null))
                .ToListAsync(ct);
            return Ok(new NotificationPageDto(items, unread, total, page, pageSize));
        }

        /// <summary>Gọi định kỳ để cập nhật số trên chuông — một phép đếm qua chỉ mục, rất nhẹ.</summary>
        [HttpGet("unread-count")]
        public async Task<ActionResult<object>> UnreadCount(CancellationToken ct)
            => Ok(new { count = await _db.Notifications.CountAsync(n => n.UserId == _currentUser.UserId && n.ReadAt == null, ct) });

        [HttpPost("{id:guid}/read")]
        public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
        {
            var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == _currentUser.UserId, ct)
                ?? throw new NotFoundException("Không tìm thấy thông báo.");
            n.ReadAt ??= DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllRead(CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            await _db.Notifications.Where(n => n.UserId == _currentUser.UserId && n.ReadAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, now), ct);
            return NoContent();
        }
    }
}

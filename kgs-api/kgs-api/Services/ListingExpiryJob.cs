using kgs_api.Data;
using kgs_api.Domain.Entity;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Tự đóng tin đăng đã hiển thị quá lâu mà không được đẩy.
    ///
    /// Không có job này, marketplace sẽ dần đầy những tin đã cho thuê từ nhiều tháng
    /// trước — người tìm nhà gọi vào thì máy bận hoặc "cho thuê rồi", và họ mất niềm tin
    /// vào toàn bộ nền tảng chứ không riêng tin đó. Đây là cách mọi sàn tin đăng thật giữ
    /// dữ liệu còn sống, và cũng là lý do nút "đẩy tin" tồn tại: chủ tin xác nhận tin còn
    /// hiệu lực bằng cách đẩy nó.
    ///
    /// Tin bị đóng KHÔNG mất: chủ tin mở lại được, khi đó nó về bản nháp để sửa giá và
    /// ngày trống rồi gửi duyệt lần nữa.</summary>
    public sealed class ListingExpiryJob
    {
        /// <summary>Số ngày một tin được hiển thị kể từ lần đẩy (hoặc lần duyệt) gần nhất.
        /// 60 ngày là mức các sàn trong nước hay dùng cho tin thường.</summary>
        private const int DaysVisible = 60;

        private readonly ApplicationDbContext _db;
        private readonly ILogger<ListingExpiryJob> _logger;

        public ListingExpiryJob(ApplicationDbContext db, ILogger<ListingExpiryJob> logger)
        {
            _db = db; _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var cutoff = DateTime.UtcNow.AddDays(-DaysVisible);

            // Mốc tính hạn là lần đẩy gần nhất, không có thì tới lần duyệt, không có nữa
            // thì tới ngày tạo — cùng thứ tự ưu tiên mà marketplace dùng để sắp xếp.
            var expired = await _db.Set<Listing>()
                .Where(l => l.Status == ListingStatus.Approved
                         && (l.BumpedAt ?? l.PublishedAt ?? l.CreatedAt) < cutoff)
                .ToListAsync(ct);

            if (expired.Count == 0) return;

            foreach (var listing in expired)
            {
                listing.Status = ListingStatus.Closed;
                listing.ModerationNote =
                    $"Tự đóng sau {DaysVisible} ngày hiển thị. Bạn có thể mở lại và gửi duyệt tin này.";
            }

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "ListingExpiryJob: đã đóng {Count} tin quá {Days} ngày hiển thị.",
                expired.Count, DaysVisible);
        }
    }
}

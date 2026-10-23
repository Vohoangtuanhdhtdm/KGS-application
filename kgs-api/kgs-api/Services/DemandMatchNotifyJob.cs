using kgs_api.Data;
using kgs_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Tin vừa được duyệt mà đang có người tìm đúng loại nhà đó: báo ngay cho chủ tin.
    ///
    /// Đây là lúc chủ tin quan tâm nhất tới tin của mình — vừa nhận thông báo "đã duyệt". Nói
    /// thêm "có 5 người đang tìm căn như thế này" kèm nút mời thì ghép đôi tự tìm tới họ, thay vì
    /// đợi họ tình cờ thấy huy hiệu ở trang Tin của tôi.
    ///
    /// Chạy nền (Hangfire) vì đếm nhu cầu là vài chục truy vấn — nút Duyệt của quản trị không được
    /// phải chờ việc đó. Mỗi lượt duyệt đưa vào hàng đợi đúng một lần.</summary>
    public sealed class DemandMatchNotifyJob
    {
        private readonly ApplicationDbContext _db;
        private readonly IMatchmakingService _matchmaking;
        private readonly INotificationSender _notifier;
        private readonly ILogger<DemandMatchNotifyJob> _logger;

        public DemandMatchNotifyJob(
            ApplicationDbContext db, IMatchmakingService matchmaking,
            INotificationSender notifier, ILogger<DemandMatchNotifyJob> logger)
        {
            _db = db; _matchmaking = matchmaking; _notifier = notifier; _logger = logger;
        }

        public async Task RunAsync(Guid listingId, CancellationToken ct)
        {
            try
            {
                var listing = await _db.Listings.AsNoTracking()
                    .Where(l => l.Id == listingId)
                    .Select(l => new { l.Title, l.Status, OwnerId = l.Asset.UserId })
                    .FirstOrDefaultAsync(ct);
                // Tin đã bị gỡ, đóng hay xoá trước khi job kịp chạy thì thôi.
                if (listing is null || listing.Status != ListingStatus.Approved) return;

                var n = await _matchmaking.CountMatchingDemandsAsync(listingId, ct);
                if (n == 0) return;

                await _notifier.SendAsync(listing.OwnerId,
                    $"Tin “{listing.Title}” khớp {n} người đang tìm",
                    "Họ đã đăng nhu cầu và đang chờ chủ nhà mời. Mời ngay để họ xem căn của bạn trước.",
                    $"/tin-cua-toi?nhu_cau={listingId}", "Mời ngay", ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Lời nhắc có thì tốt, hỏng cũng không sao: không ném lại để Hangfire khỏi thử đi
                // thử lại rồi gửi trùng.
                _logger.LogError(ex, "DemandMatchNotifyJob: không báo được cho tin {ListingId}.", listingId);
            }
        }
    }
}

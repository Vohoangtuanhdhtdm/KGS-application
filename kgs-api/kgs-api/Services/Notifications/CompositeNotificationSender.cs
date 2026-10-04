using kgs_api.Data;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Hubs;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace kgs_api.Services.Notifications
{
    /// <summary>Một lần gửi = một thông báo trong ứng dụng + một email.
    ///
    /// Bọc ở đây thay vì sửa từng nơi gọi: kiểm duyệt, báo vi phạm, quản trị, yêu cầu xem
    /// nhà, ghép đôi, nhắc lịch, bộ lọc đã lưu đều đi qua INotificationSender nên tự có
    /// thông báo trong ứng dụng.
    ///
    /// Ghi bằng một DbContext RIÊNG (scope mới): nơi gọi thường đang giữ DbContext có thay
    /// đổi chưa lưu, gọi SaveChanges trên đó sẽ lưu luôn thay đổi của người ta sớm hơn dự
    /// định. Thông báo trong ứng dụng ghi trước email — email hỏng (sai SMTP, hộp thư không
    /// tồn tại) không được làm mất thông báo.</summary>
    public sealed class CompositeNotificationSender : INotificationSender
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly EmailNotificationSender _email;
        private readonly IHubContext<NotificationsHub> _hub;
        private readonly ILogger<CompositeNotificationSender> _logger;

        public CompositeNotificationSender(
            IServiceScopeFactory scopes, EmailNotificationSender email, IHubContext<NotificationsHub> hub,
            ILogger<CompositeNotificationSender> logger)
        {
            _scopes = scopes; _email = email; _hub = hub; _logger = logger;
        }

        public async Task SendAsync(
            string userId, string title, string body, string? linkPath = null, string? linkLabel = null,
            CancellationToken ct = default)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Notifications.Add(new Notification
                {
                    UserId = userId,
                    Title = Cut(title, 200),
                    Body = Cut(body, 1000),
                    LinkPath = string.IsNullOrWhiteSpace(linkPath) ? null : Cut(linkPath, 300),
                    LinkLabel = string.IsNullOrWhiteSpace(linkLabel) ? null : Cut(linkLabel, 100),
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không lưu được thông báo trong ứng dụng cho {UserId}", userId);
            }

            // Đẩy ngay tới trình duyệt đang mở (nếu có) để giao diện tự làm mới — ví dụ trạng
            // thái tin ở "Tin của tôi" đổi ngay khi admin duyệt. Không ai đang mở thì thôi;
            // lần sau mở trang, dữ liệu được tải mới như thường. Lỗi đẩy không chặn email.
            try
            {
                await _hub.Clients.User(userId).SendAsync(
                    NotificationsHub.EventName, new { title, linkPath }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không đẩy được sự kiện thời gian thực cho {UserId}", userId);
            }

            await _email.SendAsync(userId, title, body, linkPath, linkLabel, ct);
        }

        private static string Cut(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";
    }
}

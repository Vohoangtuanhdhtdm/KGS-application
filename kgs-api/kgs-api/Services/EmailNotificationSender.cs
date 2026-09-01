
using kgs_api.Domain.Entity;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace kgs_api.Services
{
    public class EmailNotificationSender : INotificationSender
    {
        private readonly IEmailSender _email;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<EmailNotificationSender> _logger;

        public EmailNotificationSender(IEmailSender email, UserManager<ApplicationUser> userManager,
            ILogger<EmailNotificationSender> logger)
        {
            _email = email;
            _userManager = userManager;
            _logger = logger;
        }
        public async Task SendAsync(string userId, string title, string body, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId);

            if (user?.Email is null)
            {
                _logger.LogWarning("Không gửi được nhắc lịch — user {UserId} không tồn tại hoặc chưa có email.", userId);
                return;   // không throw — một reminder gửi lỗi không nên làm crash cả job quét 200 reminder khác
            }

            var html = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                  <h2>{System.Net.WebUtility.HtmlEncode(title)}</h2>
                  <p>{System.Net.WebUtility.HtmlEncode(body)}</p>
                  <p style='margin-top:24px;'>
                    <a href='https://your-app-domain.com/reminders'
                       style='background:#1e3a8a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;'>
                       Xem chi tiết trong ứng dụng</a>
                  </p>
                  <p style='font-size:12px;color:#6b7280;margin-top:32px;'>
                     Đây là email nhắc lịch tự động từ hệ thống Quản Lý Tài Sản.</p>
                </div>";

            await _email.SendAsync(user.Email, title, html, ct);
        }
    
    }
}

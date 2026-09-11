using kgs_api.Domain.Entity;
using kgs_api.Interfaces;
using kgs_api.Utility;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace kgs_api.Services
{
    /// <summary>Gửi thông báo bằng email.
    ///
    /// Ba thứ đã sửa so với bản trước, cả ba đều ảnh hưởng tới MỌI email hệ thống từng gửi:
    ///
    /// 1. **Nút bấm trỏ vào hư không.** Bản cũ viết cứng "https://your-app-domain.com/reminders"
    ///    — tên miền không tồn tại, và luôn là trang nhắc lịch kể cả khi email báo tin đăng
    ///    được duyệt. Nay ghép ClientBaseUrl từ cấu hình với đường dẫn do nơi gọi truyền vào,
    ///    đúng cách AuthService vẫn làm cho link đặt lại mật khẩu.
    ///
    /// 2. **Sai tên sản phẩm.** Chân trang ghi "hệ thống Quản Lý Tài Sản" — tên đã bỏ từ
    ///    PR #14 khi chuẩn hoá toàn bộ về KGS.
    ///
    /// 3. **Sai mô tả.** Chân trang ghi "email nhắc lịch tự động" cho cả email duyệt tin và
    ///    cảnh báo tin mới.
    ///
    /// Lưu ý cho người sửa sau: `body` được HTML-encode và đặt trong MỘT thẻ p, nên ký tự
    /// xuống dòng trong chuỗi sẽ không hiện ra. Viết body thành một đoạn liền.</summary>
    public class EmailNotificationSender : INotificationSender
    {
        private readonly IEmailSender _email;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly AuthSettings _settings;
        private readonly ILogger<EmailNotificationSender> _logger;

        public EmailNotificationSender(
            IEmailSender email,
            UserManager<ApplicationUser> userManager,
            IOptions<AuthSettings> settings,
            ILogger<EmailNotificationSender> logger)
        {
            _email = email;
            _userManager = userManager;
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task SendAsync(
            string userId,
            string title,
            string body,
            string? linkPath = null,
            string? linkLabel = null,
            CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId);

            if (user?.Email is null)
            {
                // Không throw: một email gửi lỗi không nên làm hỏng cả job quét hàng trăm
                // thông báo khác, cũng không nên làm hỏng thao tác nghiệp vụ đã ghi xong.
                _logger.LogWarning(
                    "Không gửi được thông báo — user {UserId} không tồn tại hoặc chưa có email.", userId);
                return;
            }

            var baseUrl = _settings.ClientBaseUrl.TrimEnd('/');
            var path = string.IsNullOrWhiteSpace(linkPath) ? "/" : linkPath;
            if (!path.StartsWith('/')) path = "/" + path;

            var url = System.Net.WebUtility.HtmlEncode(baseUrl + path);
            var label = System.Net.WebUtility.HtmlEncode(
                string.IsNullOrWhiteSpace(linkLabel) ? "Mở trên KGS" : linkLabel);

            var html = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                  <h2>{System.Net.WebUtility.HtmlEncode(title)}</h2>
                  <p>{System.Net.WebUtility.HtmlEncode(body)}</p>
                  <p style='margin-top:24px;'>
                    <a href='{url}'
                       style='background:#1E2761;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;'>
                       {label}</a>
                  </p>
                  <p style='font-size:12px;color:#6b7280;margin-top:32px;'>
                     Email tự động từ KGS — nền tảng tìm kiếm và kết nối bất động sản.</p>
                </div>";

            await _email.SendAsync(user.Email, title, html, ct);
        }
    }
}

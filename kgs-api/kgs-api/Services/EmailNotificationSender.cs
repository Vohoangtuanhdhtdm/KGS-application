using kgs_api.Domain.Entity;
using kgs_api.Interfaces;
using kgs_api.Services.Email;
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
    /// Giao diện thư nằm ở EmailLayout (KiGi động, nhãn loại thư, khung chi tiết, nút, mẹo). Muốn
    /// xuống đoạn trong `body` thì viết "\n\n".</summary>
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
            CancellationToken ct = default,
            IReadOnlyList<EmailDetail>? details = null)
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

            var (eyebrow, tip) = EmailLayout.KindFor(path);
            var paragraphs = new List<string>();
            if (!string.IsNullOrWhiteSpace(user.Name)) paragraphs.Add($"Chào {user.Name},");
            paragraphs.AddRange(EmailLayout.SplitParagraphs(body));

            var (html, text) = EmailLayout.Render(new EmailContent(
                Title: title,
                Preheader: body.Length <= 140 ? body : body[..139] + "…",
                Eyebrow: eyebrow,
                Paragraphs: paragraphs,
                Details: details ?? Array.Empty<EmailDetail>(),
                CtaLabel: string.IsNullOrWhiteSpace(linkLabel) ? "Mở trên KGS" : linkLabel,
                CtaUrl: baseUrl + path,
                Tip: tip));

            await _email.SendAsync(user.Email, title, html, ct, text);
        }
    }
}

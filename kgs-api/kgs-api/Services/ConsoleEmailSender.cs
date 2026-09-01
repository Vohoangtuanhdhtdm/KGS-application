using kgs_api.Interfaces;

namespace kgs_api.Services
{
    // ============================================================
    // FILE: Services/ConsoleEmailSender.cs — DÙNG CHO DEVELOPMENT
    // In link ra console để copy/paste khi test, không cần cấu hình SMTP.
    // Khi lên production, viết SmtpEmailSender/SendGridEmailSender
    // implement cùng interface rồi đổi đăng ký DI — không sửa AuthService.
    // ============================================================
    public sealed class ConsoleEmailSender : IEmailSender
    {
        private readonly ILogger<ConsoleEmailSender> _logger;
        public ConsoleEmailSender(ILogger<ConsoleEmailSender> logger) => _logger = logger;

        public Task SendEmailConfirmationAsync(string toEmail, string userName, string confirmationLink, CancellationToken ct = default)
        {
            _logger.LogWarning(
                "\n========== EMAIL XÁC THỰC (DEV) ==========\n" +
                "Đến: {Email} ({Name})\n" +
                "Link xác thực:\n{Link}\n" +
                "==========================================\n",
                toEmail, userName, confirmationLink);
            return Task.CompletedTask;
        }

        public Task SendPasswordResetAsync(string toEmail, string userName, string resetLink, CancellationToken ct = default)
        {
            _logger.LogWarning(
                "\n========== EMAIL ĐẶT LẠI MẬT KHẨU (DEV) ==========\n" +
                "Đến: {Email} ({Name})\n" +
                "Link đặt lại:\n{Link}\n" +
                "Link có hiệu lực trong thời gian giới hạn.\n" +
                "=================================================\n",
                toEmail, userName, resetLink);
            return Task.CompletedTask;
        }

        public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
        {
            _logger.LogWarning(
                "\n========== EMAIL (DEV) ==========\n" +
                "Đến: {Email}\nChủ đề: {Subject}\nNội dung (HTML):\n{Body}\n" +
                "==================================\n",
                toEmail, subject, htmlBody);
            return Task.CompletedTask;
        }

    }
}

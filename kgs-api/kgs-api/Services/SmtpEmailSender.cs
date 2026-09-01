using kgs_api.Interfaces;
using kgs_api.Utility;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MailKit.Net.Smtp;
using MimeKit;

namespace kgs_api.Services
{
    public sealed class SmtpEmailSender : IEmailSender
    {
        private readonly SmtpSettings _settings;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IOptions<SmtpSettings> settings, ILogger<SmtpEmailSender> logger)
        {
            _settings = settings.Value;
            _logger = logger;

            // ← THÊM — in ra ngay khi khởi động để xác nhận config có đọc được đúng không
            _logger.LogWarning("SmtpEmailSender khởi tạo với Host={Host} Port={Port} Username={Username} FromEmail={FromEmail}",
                _settings.Host, _settings.Port, _settings.Username, _settings.FromEmail);
        }

        public Task SendEmailConfirmationAsync(string toEmail, string userName, string confirmationLink, CancellationToken ct = default)
        {
            var html = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                      <h2>Xác thực địa chỉ email</h2>
                      <p>Xin chào {System.Net.WebUtility.HtmlEncode(userName)},</p>
                      <p>Vui lòng bấm vào nút bên dưới để xác thực địa chỉ email của bạn:</p>
                      <p><a href='{confirmationLink}' style='background:#1e3a8a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;'>Xác thực email</a></p>
                      <p>Nếu nút không hoạt động, dán link sau vào trình duyệt:<br/>{confirmationLink}</p>
                    </div>";
            return SendCoreAsync(toEmail, "Xác thực địa chỉ email của bạn", html, ct);
        }

        public Task SendPasswordResetAsync(string toEmail, string userName, string resetLink, CancellationToken ct = default)
        {
            var html = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                  <h2>Đặt lại mật khẩu</h2>
                  <p>Xin chào {System.Net.WebUtility.HtmlEncode(userName)},</p>
                  <p>Bấm vào nút bên dưới để đặt lại mật khẩu (link có hiệu lực trong thời gian giới hạn):</p>
                  <p><a href='{resetLink}' style='background:#1e3a8a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;'>Đặt lại mật khẩu</a></p>
                  <p>Nếu bạn không yêu cầu việc này, hãy bỏ qua email này.</p>
                </div>";
            return SendCoreAsync(toEmail, "Đặt lại mật khẩu", html, ct);
        }

        public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
            => SendCoreAsync(toEmail, subject, htmlBody, ct);

        // ---- Lõi dùng chung cho cả 3 method public ----
        private async Task SendCoreAsync(string toEmail, string subject, string htmlBody, CancellationToken ct)
        {

            // ← THÊM — kiểm tra config có bị rỗng không TRƯỚC khi thử kết nối
            if (string.IsNullOrWhiteSpace(_settings.Host))
            {
                _logger.LogError("SmtpSettings chưa được cấu hình — Host rỗng.");
               
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;
            message.Body = new TextPart(MimeKit.Text.TextFormat.Html) { Text = htmlBody };
            using var client = new SmtpClient();

            // ← THÊM tạm — bỏ qua lỗi certificate để loại trừ khả năng server PA VN dùng
            //     self-signed cert cho hostname mail.tenmiencuaban.com (khá phổ biến với
            //     hosting giá rẻ). CHỈ BẬT LÚC DEBUG — bật ở production là lỗ hổng bảo mật
            //     (mất khả năng xác minh server, dễ bị man-in-the-middle).
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            _logger.LogWarning("Bắt đầu kết nối SMTP tới {Host}:{Port}...", _settings.Host, _settings.Port);

            // KHÔNG bọc try/catch ở đây — để exception thật ném ra ngoài, thấy rõ trong response
            // (chỉ tạm thời cho debug; bản chính thức phải nuốt lỗi như patch-1b)
            var socketOptions = _settings.Port == 465
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;

            await client.ConnectAsync(_settings.Host, _settings.Port, socketOptions, ct);
            _logger.LogWarning("Kết nối SMTP thành công, đang xác thực...");

            await client.AuthenticateAsync(_settings.Username, _settings.Password, ct);
            _logger.LogWarning("Xác thực SMTP thành công, đang gửi mail tới {ToEmail}...", toEmail);

            await client.SendAsync(message, ct);
            _logger.LogWarning("Gửi mail thành công!");

            await client.DisconnectAsync(true, ct);
   
        }
    }
}

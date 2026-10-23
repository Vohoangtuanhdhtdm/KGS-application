using kgs_api.Interfaces;
using kgs_api.Services.Email;
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
            var (html, text) = EmailLayout.Render(new EmailContent(
                Title: "Chào mừng bạn đến với KGS!",
                Preheader: "Còn một bước nữa: xác nhận email để bắt đầu tìm nhà cùng KiGi.",
                Eyebrow: "Xác thực tài khoản",
                Paragraphs: new[]
                {
                    $"Chào {userName},",
                    "Cảm ơn bạn đã đăng ký. Bấm nút bên dưới để xác nhận đây đúng là email của bạn — xong là bạn lưu tin, đăng nhu cầu và nhận lời mời xem nhà được ngay.",
                },
                Details: Array.Empty<EmailDetail>(),
                CtaLabel: "Xác nhận email",
                CtaUrl: confirmationLink,
                Tip: "Nếu bạn không tạo tài khoản KGS, cứ bỏ qua email này."));
            return SendCoreAsync(toEmail, "Xác nhận email để bắt đầu dùng KGS", html, text, ct);
        }

        public Task SendPasswordResetAsync(string toEmail, string userName, string resetLink, CancellationToken ct = default)
        {
            var (html, text) = EmailLayout.Render(new EmailContent(
                Title: "Đặt lại mật khẩu",
                Preheader: "Liên kết đặt lại mật khẩu KGS của bạn — chỉ dùng được trong thời gian ngắn.",
                Eyebrow: "Bảo mật tài khoản",
                Paragraphs: new[]
                {
                    $"Chào {userName},",
                    "KiGi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để chọn mật khẩu mới. Liên kết chỉ dùng được trong thời gian ngắn.",
                },
                Details: Array.Empty<EmailDetail>(),
                CtaLabel: "Đặt mật khẩu mới",
                CtaUrl: resetLink,
                Tip: "Nếu bạn không yêu cầu việc này, hãy bỏ qua email — mật khẩu hiện tại vẫn giữ nguyên."));
            return SendCoreAsync(toEmail, "Đặt lại mật khẩu KGS", html, text, ct);
        }

        public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default,
            string? textBody = null)
            => SendCoreAsync(toEmail, subject, htmlBody, textBody, ct);

        /// <summary>Ảnh nhúng vào thư (KiGi động, biểu tượng) — EmbeddedResource trong Assets/Email.
        /// Tên ảnh = content-id + đuôi (kigi.gif, icon-phone.png). Đọc một lần rồi giữ.</summary>
        private static readonly Lazy<Dictionary<string, (byte[] Data, ContentType Type)>> EmailAssets = new(() =>
        {
            var asm = typeof(SmtpEmailSender).Assembly;
            var map = new Dictionary<string, (byte[], ContentType)>();
            foreach (var name in asm.GetManifestResourceNames().Where(n => n.Contains(".Assets.Email.")))
            {
                var file = name[(name.IndexOf(".Assets.Email.", StringComparison.Ordinal) + ".Assets.Email.".Length)..];
                var ext = Path.GetExtension(file).TrimStart('.').ToLowerInvariant();
                if (ext is not ("gif" or "png")) continue;
                using var s = asm.GetManifestResourceStream(name)!;
                using var ms = new MemoryStream();
                s.CopyTo(ms);
                map[Path.GetFileNameWithoutExtension(file)] = (ms.ToArray(), new ContentType("image", ext));
            }
            return map;
        });

        // ---- Lõi dùng chung cho cả 3 method public ----
        private async Task SendCoreAsync(string toEmail, string subject, string htmlBody, string? textBody, CancellationToken ct)
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
            var builder = new BodyBuilder { HtmlBody = htmlBody, TextBody = textBody };
            foreach (var cid in EmailLayout.ContentIds(htmlBody))
            {
                if (!EmailAssets.Value.TryGetValue(cid, out var asset)) continue;
                var part = builder.LinkedResources.Add($"{cid}.{asset.Type.MediaSubtype}", asset.Data, asset.Type);
                part.ContentId = cid;
            }
            message.Body = builder.ToMessageBody();
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

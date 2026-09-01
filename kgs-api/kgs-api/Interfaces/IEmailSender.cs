namespace kgs_api.Interfaces
{
    public interface IEmailSender
    {
        Task SendEmailConfirmationAsync(string toEmail, string userName, string confirmationLink, CancellationToken ct = default);
        Task SendPasswordResetAsync(string toEmail, string userName, string resetLink, CancellationToken ct = default);

        /// <summary>MỚI — gửi email tự do (chủ đề + nội dung HTML bất kỳ). Dùng cho báo cáo
        /// hàng tháng, thông báo đa kênh (MultiChannelNotificationSender), và mọi nhu cầu gửi
        /// mail khác ngoài xác thực/đặt lại mật khẩu.</summary>
        Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
    }
}

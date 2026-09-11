namespace kgs_api.Interfaces
{
    /// <summary>Gửi thông báo tới một người dùng. Hiện cài đặt bằng email.</summary>
    public interface INotificationSender
    {
        /// <summary>Gửi thông báo.</summary>
        /// <param name="linkPath">Đường dẫn TƯƠNG ĐỐI trong ứng dụng mà nút trong email trỏ
        /// tới, ví dụ "/yeu-cau". Máy chủ ghép với ClientBaseUrl trong cấu hình.
        ///
        /// Trước đây hàm này viết cứng "https://your-app-domain.com/reminders" cho MỌI loại
        /// thông báo — một tên miền không tồn tại, và luôn trỏ trang nhắc lịch kể cả khi
        /// email nói về việc duyệt tin. Người nhận bấm vào là rơi vào hư không.
        ///
        /// null = nút trỏ về trang chủ.</summary>
        Task SendAsync(
            string userId,
            string title,
            string body,
            string? linkPath = null,
            string? linkLabel = null,
            CancellationToken ct = default);
    }
}

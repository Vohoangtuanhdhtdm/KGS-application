using System.ComponentModel.DataAnnotations;
using kgs_api.Common;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Thông báo trong ứng dụng (chuông ở thanh trên cùng).
    ///
    /// Trước đây mọi thông báo chỉ đi bằng email: người dùng phải mở hộp thư mới biết tin
    /// được duyệt hay có người hỏi thuê — và với tài khoản không có hộp thư thật (tài khoản
    /// demo, email gõ nhầm) thì không bao giờ biết. Mỗi lần INotificationSender gửi, một bản
    /// ghi ở đây được tạo cùng lúc với email (xem CompositeNotificationSender).</summary>
    public class Notification : BaseAuditableEntity
    {
        [Required] public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
        [MaxLength(1000)] public string Body { get; set; } = string.Empty;

        /// <summary>Đường dẫn tương đối trong ứng dụng, ví dụ "/yeu-cau".</summary>
        [MaxLength(300)] public string? LinkPath { get; set; }
        [MaxLength(100)] public string? LinkLabel { get; set; }

        public DateTime? ReadAt { get; set; }
    }
}

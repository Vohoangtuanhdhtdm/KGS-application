using System.ComponentModel.DataAnnotations;
using kgs_api.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Một lượt kiểm duyệt tin đăng — ai làm gì, lúc nào, vì sao.
    ///
    /// Vì sao cần bảng riêng thay vì một trường trên Listing. Trước đây toàn bộ lịch sử
    /// kiểm duyệt gói trong đúng một cột `ModerationNote` 500 ký tự, và nó bị GHI ĐÈ mỗi
    /// lần. Tin đi qua ba vòng thì hai lý do đầu biến mất — kiểm duyệt viên thứ hai không
    /// biết người trước đã yêu cầu gì, còn chủ tin sửa xong lần ba thì không nhớ nổi lần
    /// một mình sai chỗ nào.
    ///
    /// Bảng này chỉ GHI THÊM, không bao giờ sửa hay xoá dòng cũ. Đó là điều kiện để nó
    /// dùng được vào hai việc: cho chủ tin xem lại toàn bộ yêu cầu đã nhận, và cho biết
    /// người đăng hay sai ở đâu nhất để còn sửa chính biểu mẫu đăng tin.</summary>
    public class ListingModerationEvent : BaseAuditableEntity
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        public ModerationAction Action { get; set; }

        /// <summary>Các lý do đã chọn. Rỗng với hành động Approved và Submitted.
        ///
        /// Lưu dạng mảng thay vì một giá trị: một tin thường sai nhiều thứ cùng lúc, và ép
        /// kiểm duyệt viên chọn đúng một lý do sẽ khiến họ chọn "Khác" cho mọi trường hợp —
        /// đúng lúc đó thì cả việc thống kê lẫn việc chuẩn hoá đều mất tác dụng.</summary>
        public List<ModerationReason> Reasons { get; set; } = new();

        /// <summary>Ghi chú tự do đi kèm. Bắt buộc khi lý do là Other.</summary>
        [MaxLength(1000)] public string? Note { get; set; }

        /// <summary>Người thực hiện. Null với hành động Submitted do chính chủ tin gửi —
        /// khi đó người thực hiện chính là chủ tin, không cần lưu lại lần nữa.
        ///
        /// KHÔNG lộ ra cho chủ tin: giao diện phía họ chỉ hiện hành động, lý do và thời
        /// điểm. Kiểm duyệt viên không nên trở thành đích nhắm của một tranh cãi cá nhân.</summary>
        public string? ModeratorUserId { get; set; }
        public ApplicationUser? Moderator { get; set; }

        /// <summary>Vòng thứ mấy, tính từ 1. Tiện cho cả hiển thị lẫn truy vấn thống kê
        /// "bao nhiêu tin cần hơn hai vòng mới đăng được".</summary>
        public int Round { get; set; }
    }
}

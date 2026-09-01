using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Yêu cầu xem nhà / liên hệ gửi từ một tin đăng công khai.
    ///
    /// Đây là đường dữ liệu DUY NHẤT nối marketplace với nghiệp vụ quản lý hợp đồng.
    /// Trước khi có bảng này, khách tìm được nhà rồi gọi điện — giao dịch rời khỏi hệ
    /// thống, và chủ nhà phải gõ lại tên với số điện thoại thành ContactParty bằng tay.
    ///
    /// Trường ConvertedContactPartyId biến thao tác đó thành một nút bấm, đồng thời là
    /// bằng chứng đầu tiên cho thấy hệ thống thực sự "kết nối" được ai với ai.</summary>
    public class ListingInquiry : BaseAuditableEntity
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        [Required] public string FromUserId { get; set; } = string.Empty;   // người đi tìm thuê
        public ApplicationUser FromUser { get; set; } = null!;

        // Denormalize chủ tin: hộp thư "yêu cầu nhận được" lọc thẳng theo cột này,
        // không phải JOIN qua Properties.
        [Required] public string ToUserId { get; set; } = string.Empty;

        [MaxLength(1000)] public string? Message { get; set; }
        public DateTime? PreferredViewingAt { get; set; }
        public InquiryStatus Status { get; set; } = InquiryStatus.New;

        /// <summary>Null cho tới khi chủ nhà bấm "Chuyển thành khách thuê".
        /// Có giá trị = đã sinh ContactParty, sẵn sàng ký hợp đồng.</summary>
        public Guid? ConvertedContactPartyId { get; set; }
        public ContactParty? ConvertedContactParty { get; set; }
    }
}

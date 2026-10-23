using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Yêu cầu xem nhà / liên hệ gửi từ một tin đăng công khai.
    ///
    /// Trước khi có bảng này, khách tìm được nhà rồi gọi điện — mối liên hệ rời khỏi hệ
    /// thống và không ai đo được nền tảng đã kết nối được ai với ai.</summary>
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

        /// <summary>Ưu đãi riêng chép cứng từ lời mời khi người tìm nhận lời — cả hai bên cùng
        /// thấy đúng con số đã hứa, kể cả khi tin đổi giá sau đó.</summary>
        public decimal? OfferPrice { get; set; }
        [MaxLength(120)] public string? OfferNote { get; set; }

    }
}

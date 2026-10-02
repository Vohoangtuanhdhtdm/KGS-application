using System.ComponentModel.DataAnnotations;
using kgs_api.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Lời mời xem nhà: chủ tin mời một người đang tìm nhà phù hợp (ghép đôi hai chiều).
    ///
    /// Trước đây "kết nối" chỉ đi một chiều — người tìm gửi yêu cầu, chủ tin ngồi chờ. Chủ
    /// tin có nhà trống nhưng không có cách nào biết ai đang cần đúng loại nhà đó. Lời mời
    /// cho chủ tin chủ động, mà vẫn giữ quyền riêng tư của người tìm: chủ tin chỉ thấy NHU
    /// CẦU (tiêu chí + lời nhắn), không thấy danh tính. Danh tính chỉ lộ ra khi người tìm
    /// NHẬN lời — lúc đó lời mời sinh ra một <see cref="ListingInquiry"/> bình thường, và luồng
    /// xem nhà → chuyển thành khách thuê → hợp đồng chạy tiếp như mọi yêu cầu khác.</summary>
    public class ListingInvitation : BaseAuditableEntity
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        /// <summary>Nhu cầu được mời. Null khi người tìm đã xoá bộ lọc đó — lời mời vẫn còn
        /// trong hộp thư của họ.</summary>
        public Guid? SavedSearchId { get; set; }
        public SavedSearch? SavedSearch { get; set; }

        [Required] public string OwnerUserId { get; set; } = string.Empty;
        [Required] public string SeekerUserId { get; set; } = string.Empty;
        public ApplicationUser Seeker { get; set; } = null!;

        [MaxLength(500)] public string? Message { get; set; }
        public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
        public DateTime? RespondedAt { get; set; }

        /// <summary>Yêu cầu xem nhà sinh ra khi người tìm nhận lời.</summary>
        public Guid? InquiryId { get; set; }
        public ListingInquiry? Inquiry { get; set; }
    }
}

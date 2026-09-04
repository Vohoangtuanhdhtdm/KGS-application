using System.ComponentModel.DataAnnotations;
using kgs_api.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Một lượt báo vi phạm với tin đăng.
    ///
    /// Kiểm duyệt trước khi đăng chỉ chặn được thứ nhìn là biết sai. Phần lớn cái sai thật
    /// sự chỉ lộ ra SAU khi tin đã chạy: phòng cho thuê rồi mà tin vẫn treo, ảnh lấy của
    /// nhà khác, người đăng đòi cọc trước khi cho xem. Người duy nhất phát hiện được những
    /// điều đó là người vừa gọi điện hỏi — nên phải có đường để họ nói lại.
    ///
    /// Đây cũng là thứ giữ cho kho tin còn đáng tin. Một sàn đầy tin ma thì người tìm nhà
    /// bỏ đi, và họ bỏ đi lặng lẽ chứ không báo cho ai biết.</summary>
    public class ListingReport : BaseAuditableEntity
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        /// <summary>Bắt buộc đăng nhập mới báo được. Báo ẩn danh thì đúng là dễ cho người
        /// tử tế, nhưng nó cũng là công cụ hoàn hảo để dìm tin của đối thủ — và chưa có
        /// hạ tầng giới hạn theo IP (việc đó thuộc nhiệm vụ 1.10).</summary>
        [Required] public string ReporterUserId { get; set; } = string.Empty;
        public ApplicationUser Reporter { get; set; } = null!;

        public ListingReportReason Reason { get; set; }

        [MaxLength(1000)] public string? Detail { get; set; }

        public ListingReportStatus Status { get; set; } = ListingReportStatus.Pending;

        public DateTime? HandledAt { get; set; }
        public string? HandledByUserId { get; set; }

        /// <summary>Ghi chú của người kiểm duyệt khi đóng báo cáo.</summary>
        [MaxLength(500)] public string? HandlerNote { get; set; }
    }
}

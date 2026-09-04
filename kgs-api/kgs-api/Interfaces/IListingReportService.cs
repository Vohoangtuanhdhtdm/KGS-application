using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    /// <summary>Báo vi phạm với tin đăng (nhiệm vụ 1.7).</summary>
    public interface IListingReportService
    {
        /// <summary>Người xem báo một tin có vấn đề. Báo lại một tin mình đã báo mà chưa
        /// được xử lý thì không tạo bản ghi mới.</summary>
        Task ReportAsync(string slug, CreateListingReportRequest request, CancellationToken ct = default);

        /// <summary>Hàng đợi kiểm duyệt, cũ nhất trước.</summary>
        Task<IReadOnlyList<ListingReportDto>> GetForModerationAsync(
            ListingReportStatus? status, CancellationToken ct = default);

        /// <summary>Đóng một báo cáo. Đóng luôn MỌI báo cáo đang chờ khác trên cùng tin —
        /// người kiểm duyệt đã xem tin đó rồi, bắt họ bấm lại cho từng người báo là vô nghĩa.</summary>
        Task ResolveAsync(Guid reportId, ResolveListingReportRequest request, CancellationToken ct = default);
    }
}

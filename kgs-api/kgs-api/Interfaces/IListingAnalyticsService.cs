using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    /// <summary>Bảng phân tích cho người đăng tin (nhiệm vụ 1.8).</summary>
    public interface IListingAnalyticsService
    {
        /// <summary>Tổng quan mọi tin của người đang đăng nhập.</summary>
        Task<OwnerAnalyticsSummaryDto> GetOwnerSummaryAsync(CancellationToken ct = default);

        /// <summary>Chi tiết một tin. Chỉ chủ tin xem được.</summary>
        Task<ListingAnalyticsDto> GetForListingAsync(Guid listingId, CancellationToken ct = default);
    }
}

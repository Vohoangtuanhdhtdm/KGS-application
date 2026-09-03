using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    /// <summary>Phía CUNG của marketplace: đăng tin, sửa, gỡ, tìm kiếm công khai.
    /// Phía CẦU (lưu tin, yêu cầu xem nhà) nằm ở IMarketplaceEngagementService.</summary>
    public interface IListingService
    {
        Task<OwnerListingDto> CreateAsync(Guid assetId, CreateListingRequest request, CancellationToken ct = default);
        Task<OwnerListingDto> UpdateAsync(Guid listingId, UpdateListingRequest request, CancellationToken ct = default);

        /// <summary>Đóng tin (đã có khách / đã bán). Không xoá — giữ lịch sử và lượt xem.</summary>
        Task CloseAsync(Guid listingId, CancellationToken ct = default);

        Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default);
        Task<IReadOnlyList<OwnerListingDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default);

        Task<PagedResult<PublicListingSummaryDto>> SearchPublicAsync(PublicListingSearchQuery query, CancellationToken ct = default);
        Task<PublicListingDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default);
    }
}

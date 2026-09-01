using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    public interface IPropertyListingService
    {
        Task<OwnerListingDto> CreateFromAssetAsync(Guid assetId, CreateListingFromAssetRequest request, CancellationToken ct = default);
        Task<PagedResult<PublicPropertySummaryDto>> SearchPublicAsync(PublicPropertySearchQuery query, CancellationToken ct = default);
        Task<PublicPropertyDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default);
        Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default);
    }
}

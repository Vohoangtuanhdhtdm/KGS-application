using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    public interface IAssetService
    {
        Task<AssetDetailDto> CreateAsync(AssetCreateRequest request, CancellationToken ct = default);
        Task<AssetDetailDto> UpdateAsync(Guid assetId, AssetUpdateRequest request, CancellationToken ct = default);
        Task<IReadOnlyList<AssetMapPinDto>> GetMapPinsAsync(CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, CancellationToken ct = default);
        Task<AssetDetailDto> GetByIdAsync(Guid assetId, CancellationToken ct = default);
        Task<PagedResult<AssetSummaryDto>> SearchAsync(AssetSearchQuery query, CancellationToken ct = default);
        Task<IReadOnlyList<AssetNearbyDto>> FindNearbyAsync(NearbyQuery query, CancellationToken ct = default);
        Task LinkPropertyAsync(Guid assetId, int propertyId, CancellationToken ct = default);
        Task UnlinkPropertyAsync(Guid assetId, CancellationToken ct = default);
    }
}

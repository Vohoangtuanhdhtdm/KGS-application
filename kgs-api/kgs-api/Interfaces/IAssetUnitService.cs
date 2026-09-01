using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // A6 — TẦNG / PHÒNG
    // ============================================================
    public interface IAssetUnitService
    {
        Task<AssetUnitDto> CreateAsync(Guid assetId, AssetUnitRequest request, CancellationToken ct = default);
        Task<AssetUnitDto> UpdateAsync(Guid assetId, Guid unitId, AssetUnitRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid unitId, CancellationToken ct = default);
        Task<IReadOnlyList<AssetUnitDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default);
    }
}

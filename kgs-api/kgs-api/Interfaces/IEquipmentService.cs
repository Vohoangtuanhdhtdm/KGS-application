using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // D4 — TRANG THIẾT BỊ
    // ============================================================
    public interface IEquipmentService
    {
        Task<EquipmentDto> CreateAsync(Guid assetId, EquipmentRequest request, CancellationToken ct = default);
        Task<EquipmentDto> UpdateAsync(Guid assetId, Guid equipmentId, EquipmentRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid equipmentId, CancellationToken ct = default);
        Task<IReadOnlyList<EquipmentDto>> GetByAssetAsync(Guid assetId, Guid? unitId, CancellationToken ct = default);
    }
}

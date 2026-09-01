using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // D3 — LỊCH SỬ SỬA CHỮA (tuỳ chọn tự ghi chi phí vào sổ cái)
    // ============================================================
    public interface IMaintenanceService
    {
        Task<MaintenanceDto> CreateAsync(Guid assetId, MaintenanceRequest request, CancellationToken ct = default);
        Task<MaintenanceDto> UpdateAsync(Guid assetId, Guid recordId, MaintenanceRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid recordId, CancellationToken ct = default);
        Task<IReadOnlyList<MaintenanceDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default);
    }
}

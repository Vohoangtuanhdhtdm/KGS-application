using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // D5 — LỊCH SỬ SỬ DỤNG (bản thân / con cái / người quen)
    // ============================================================
    public interface IUsagePeriodService
    {
        Task<UsagePeriodDto> CreateAsync(Guid assetId, UsagePeriodRequest request, CancellationToken ct = default);
        Task<UsagePeriodDto> UpdateAsync(Guid assetId, Guid periodId, UsagePeriodRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid periodId, CancellationToken ct = default);
        Task<IReadOnlyList<UsagePeriodDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default);
    }
}

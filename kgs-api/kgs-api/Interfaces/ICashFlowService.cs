using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    // ============================================================
    // C1 — SỔ CÁI THU/CHI
    // ============================================================
    public interface ICashFlowService
    {
        Task<CashFlowDto> CreateAsync(CashFlowCreateRequest request, CancellationToken ct = default);
        Task<KeysetPage<CashFlowDto>> ListAsync(CashFlowQuery query, CancellationToken ct = default);
        Task DeleteAsync(Guid entryId, CancellationToken ct = default);
    }
}

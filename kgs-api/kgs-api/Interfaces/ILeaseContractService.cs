using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    public interface ILeaseContractService
    {
        Task<LeaseContractDto> CreateAsync(LeaseContractCreateRequest request, CancellationToken ct = default);
        Task<LeaseContractDto> RenewAsync(Guid contractId, LeaseContractRenewRequest request, CancellationToken ct = default);
        Task TerminateAsync(Guid contractId, LeaseContractTerminateRequest request, CancellationToken ct = default);
        Task<LeaseContractDto> GetByIdAsync(Guid contractId, CancellationToken ct = default);
        Task<PagedResult<LeaseContractDto>> SearchAsync(LeaseContractSearchQuery query, CancellationToken ct = default);
        Task<IReadOnlyList<ExpiringContractDto>> GetExpiringAsync(int withinDays, CancellationToken ct = default);
    }
}

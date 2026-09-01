using kgs_api.Dtos;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    // ============================================================
    // B1 — SỔ ĐỐI TÁC (người thuê / chủ nhà / môi giới / nhà thầu)
    // ============================================================
    public interface IContactPartyService
    {
        Task<ContactPartyDto> CreateAsync(ContactPartyRequest request, CancellationToken ct = default);
        Task<ContactPartyDto> UpdateAsync(Guid contactId, ContactPartyRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid contactId, CancellationToken ct = default);
        Task<PagedResult<ContactPartyDto>> ListAsync(ContactType? type, string? keyword, int page, int pageSize, CancellationToken ct = default);
    }
}

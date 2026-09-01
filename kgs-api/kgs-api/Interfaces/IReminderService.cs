using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    // ============================================================
    // D1 — REMINDER CRUD + UPCOMING
    // ============================================================
    public interface IReminderService
    {
        Task<ReminderDto> CreateAsync(ReminderCreateRequest request, CancellationToken ct = default);
        Task<ReminderDto> UpdateAsync(Guid reminderId, ReminderUpdateRequest request, CancellationToken ct = default);
        Task DeleteAsync(Guid reminderId, CancellationToken ct = default);
        Task<IReadOnlyList<ReminderDto>> GetUpcomingAsync(int withinDays, CancellationToken ct = default);
        Task<PagedResult<ReminderDto>> ListAsync(bool? isActive, int page, int pageSize, CancellationToken ct = default);
    }
}

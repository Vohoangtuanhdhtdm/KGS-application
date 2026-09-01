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

        /// <summary>Xác nhận đã thu / đã trả tiền thuê của kỳ hiện tại: sinh bút toán
        /// vào sổ cái rồi đẩy nhắc lịch sang kỳ kế tiếp. Một cú click thay cho việc
        /// nhập tay hai bút toán mỗi tháng cho mỗi phòng.</summary>
        Task<CashFlowDto> SettleAsync(Guid reminderId, SettleReminderRequest request, CancellationToken ct = default);
    }
}

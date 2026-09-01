using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    // ============================================================
    // D1 — NHẮC LỊCH (đứng riêng, phạm vi toàn user — không nested dưới asset)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/reminders")]
    public sealed class RemindersController : ControllerBase
    {
        private readonly IReminderService _reminders;
        public RemindersController(IReminderService reminders) => _reminders = reminders;

        [HttpPost]
        public async Task<ActionResult<ReminderDto>> Create(
            [FromBody] ReminderCreateRequest request, CancellationToken ct)
            => Ok(await _reminders.CreateAsync(request, ct));

        [HttpPut("{reminderId:guid}")]
        public async Task<ActionResult<ReminderDto>> Update(
            Guid reminderId, [FromBody] ReminderUpdateRequest request, CancellationToken ct)
            => Ok(await _reminders.UpdateAsync(reminderId, request, ct));

        [HttpDelete("{reminderId:guid}")]
        public async Task<IActionResult> Delete(Guid reminderId, CancellationToken ct)
        {
            await _reminders.DeleteAsync(reminderId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<ReminderDto>>> List(
            [FromQuery] bool? isActive, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
            => Ok(await _reminders.ListAsync(isActive, page, pageSize, ct));

        /// <summary>Xác nhận đã thu tiền (LeaseOut) hoặc đã trả tiền cho chủ nhà (LeaseIn).
        /// Sinh bút toán vào sổ cái và đẩy nhắc lịch sang kỳ kế tiếp — báo cáo lợi nhuận
        /// tự cập nhật ngay mà không phải vào màn hình Thu chi nhập tay.</summary>
        [HttpPost("{reminderId:guid}/settle")]
        public async Task<ActionResult<CashFlowDto>> Settle(
            Guid reminderId, [FromBody] SettleReminderRequest request, CancellationToken ct)
            => Ok(await _reminders.SettleAsync(reminderId, request, ct));

        /// <summary>Nhắc lịch sắp đến hạn trong N ngày — dùng cho widget "sắp tới" trên dashboard.</summary>
        [HttpGet("upcoming")]
        public async Task<ActionResult<IReadOnlyList<ReminderDto>>> Upcoming(
            [FromQuery] int days = 7, CancellationToken ct = default)
            => Ok(await _reminders.GetUpcomingAsync(days, ct));
    }
}

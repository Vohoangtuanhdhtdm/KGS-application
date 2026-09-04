using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // E3 — BỘ LỌC ĐÃ LƯU (phía người đi tìm thuê)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/saved-searches")]
    public sealed class SavedSearchesController : ControllerBase
    {
        private readonly ISavedSearchService _service;
        public SavedSearchesController(ISavedSearchService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<SavedSearchDto>>> GetMine(CancellationToken ct)
            => Ok(await _service.GetMineAsync(ct));

        [HttpPost]
        public async Task<ActionResult<SavedSearchDto>> Create(
            [FromBody] CreateSavedSearchRequest request, CancellationToken ct)
        {
            try
            {
                return Ok(await _service.CreateAsync(request, ct));
            }
            catch (InvalidOperationException ex)
            {
                // Chạm trần số bộ lọc — lỗi của người dùng, không phải lỗi hệ thống.
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPatch("{id:guid}/notify")]
        public async Task<ActionResult<SavedSearchDto>> SetNotify(
            Guid id, [FromQuery] bool enabled, CancellationToken ct)
            => Ok(await _service.SetNotifyAsync(id, enabled, ct));

        /// <summary>Đánh dấu đã xem hết tin mới của bộ lọc này — huy hiệu về 0.</summary>
        [HttpPost("{id:guid}/seen")]
        public async Task<IActionResult> MarkSeen(Guid id, CancellationToken ct)
        {
            await _service.MarkSeenAsync(id, ct);
            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        {
            await _service.DeleteAsync(id, ct);
            return NoContent();
        }
    }
}

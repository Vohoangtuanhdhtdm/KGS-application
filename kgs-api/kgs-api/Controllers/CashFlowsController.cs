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
    // C1 — SỔ CÁI THU/CHI
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/cashflows")]
    public sealed class CashFlowsController : ControllerBase
    {
        private readonly ICashFlowService _cashFlows;
        public CashFlowsController(ICashFlowService cashFlows) => _cashFlows = cashFlows;

        /// <summary>Multipart form-data vì có thể kèm ảnh biên lai/hoá đơn.</summary>
        [HttpPost]
        [RequestSizeLimit(30_000_000)]
        public async Task<ActionResult<CashFlowDto>> Create(
            [FromForm] CashFlowCreateRequest request, CancellationToken ct)
            => Ok(await _cashFlows.CreateAsync(request, ct));

        /// <summary>Keyset pagination — truyền lại `cursor` từ response trước để lấy trang kế tiếp.</summary>
        [HttpGet]
        public async Task<ActionResult<KeysetPage<CashFlowDto>>> List(
            [FromQuery] CashFlowQuery query, CancellationToken ct)
            => Ok(await _cashFlows.ListAsync(query, ct));

        [HttpDelete("{entryId:guid}")]
        public async Task<IActionResult> Delete(Guid entryId, CancellationToken ct)
        {
            await _cashFlows.DeleteAsync(entryId, ct);
            return NoContent();
        }
    }
}

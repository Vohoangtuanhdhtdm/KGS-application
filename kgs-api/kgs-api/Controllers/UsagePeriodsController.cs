using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // D5 — LỊCH SỬ SỬ DỤNG (nested dưới asset)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/usage-periods")]
    public sealed class UsagePeriodsController : ControllerBase
    {
        private readonly IUsagePeriodService _usagePeriods;
        public UsagePeriodsController(IUsagePeriodService usagePeriods) => _usagePeriods = usagePeriods;

        [HttpPost]
        public async Task<ActionResult<UsagePeriodDto>> Create(
            Guid assetId, [FromBody] UsagePeriodRequest request, CancellationToken ct)
            => Ok(await _usagePeriods.CreateAsync(assetId, request, ct));

        [HttpPut("{periodId:guid}")]
        public async Task<ActionResult<UsagePeriodDto>> Update(
            Guid assetId, Guid periodId, [FromBody] UsagePeriodRequest request, CancellationToken ct)
            => Ok(await _usagePeriods.UpdateAsync(assetId, periodId, request, ct));

        [HttpDelete("{periodId:guid}")]
        public async Task<IActionResult> Delete(Guid assetId, Guid periodId, CancellationToken ct)
        {
            await _usagePeriods.DeleteAsync(assetId, periodId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<UsagePeriodDto>>> GetByAsset(Guid assetId, CancellationToken ct)
            => Ok(await _usagePeriods.GetByAssetAsync(assetId, ct));
    }
}

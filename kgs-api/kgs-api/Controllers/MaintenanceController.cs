using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // D3 — LỊCH SỬ SỬA CHỮA (nested dưới asset)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/maintenance")]
    public sealed class MaintenanceController : ControllerBase
    {
        private readonly IMaintenanceService _maintenance;
        public MaintenanceController(IMaintenanceService maintenance) => _maintenance = maintenance;

        /// <summary>request.RecordAsExpense=true (mặc định) sẽ tự ghi một CashFlowEntry (MaintenanceCost)
        /// cùng transaction, giúp báo cáo lợi nhuận tự động chính xác.</summary>
        [HttpPost]
        public async Task<ActionResult<MaintenanceDto>> Create(
            Guid assetId, [FromBody] MaintenanceRequest request, CancellationToken ct)
            => Ok(await _maintenance.CreateAsync(assetId, request, ct));

        [HttpPut("{recordId:guid}")]
        public async Task<ActionResult<MaintenanceDto>> Update(
            Guid assetId, Guid recordId, [FromBody] MaintenanceRequest request, CancellationToken ct)
            => Ok(await _maintenance.UpdateAsync(assetId, recordId, request, ct));

        [HttpDelete("{recordId:guid}")]
        public async Task<IActionResult> Delete(Guid assetId, Guid recordId, CancellationToken ct)
        {
            await _maintenance.DeleteAsync(assetId, recordId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<MaintenanceDto>>> GetByAsset(Guid assetId, CancellationToken ct)
            => Ok(await _maintenance.GetByAssetAsync(assetId, ct));
    }
}

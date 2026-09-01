using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // D4 — TRANG THIẾT BỊ (nested dưới asset)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/equipment")]
    public sealed class EquipmentController : ControllerBase
    {
        private readonly IEquipmentService _equipment;
        public EquipmentController(IEquipmentService equipment) => _equipment = equipment;

        [HttpPost]
        public async Task<ActionResult<EquipmentDto>> Create(
            Guid assetId, [FromBody] EquipmentRequest request, CancellationToken ct)
            => Ok(await _equipment.CreateAsync(assetId, request, ct));

        [HttpPut("{equipmentId:guid}")]
        public async Task<ActionResult<EquipmentDto>> Update(
            Guid assetId, Guid equipmentId, [FromBody] EquipmentRequest request, CancellationToken ct)
            => Ok(await _equipment.UpdateAsync(assetId, equipmentId, request, ct));

        [HttpDelete("{equipmentId:guid}")]
        public async Task<IActionResult> Delete(Guid assetId, Guid equipmentId, CancellationToken ct)
        {
            await _equipment.DeleteAsync(assetId, equipmentId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<EquipmentDto>>> GetByAsset(
            Guid assetId, [FromQuery] Guid? unitId, CancellationToken ct)
            => Ok(await _equipment.GetByAssetAsync(assetId, unitId, ct));
    }
}

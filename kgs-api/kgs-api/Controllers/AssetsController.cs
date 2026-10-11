using kgs_api.Authorization;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Căn/phòng của một toà nhà — trang Toà nhà của người đăng tin thêm, sửa, xoá căn.
    ///
    /// Trước đây controller này còn cả CRUD, ảnh và bản đồ tài sản của khu quản lý tài sản; khu đó
    /// đã gỡ khỏi đề tài. Tạo toà nhà đi qua api/buildings, đăng tin qua api/listings.</summary>
    [ApiController]
    [Authorize(Policy = AppPolicies.Owner)]
    [Route("api/assets/{assetId:guid}/units")]
    public sealed class AssetsController : ControllerBase
    {
        private readonly IAssetUnitService _units;

        public AssetsController(IAssetUnitService units) => _units = units;

        [HttpPost]
        public async Task<ActionResult<AssetUnitDto>> CreateUnit(
            Guid assetId, [FromBody] AssetUnitRequest request, CancellationToken ct)
            => Ok(await _units.CreateAsync(assetId, request, ct));

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<AssetUnitDto>>> GetUnits(Guid assetId, CancellationToken ct)
            => Ok(await _units.GetByAssetAsync(assetId, ct));

        [HttpPut("{unitId:guid}")]
        public async Task<ActionResult<AssetUnitDto>> UpdateUnit(
            Guid assetId, Guid unitId, [FromBody] AssetUnitRequest request, CancellationToken ct)
            => Ok(await _units.UpdateAsync(assetId, unitId, request, ct));

        [HttpDelete("{unitId:guid}")]
        public async Task<IActionResult> DeleteUnit(Guid assetId, Guid unitId, CancellationToken ct)
        {
            await _units.DeleteAsync(assetId, unitId, ct);
            return NoContent();
        }
    }
}

using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // D6 — RAO BÁN (nested dưới asset, 1–1)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/sale-listing")]
    public sealed class SaleListingsController : ControllerBase
    {
        private readonly ISaleListingService _saleListings;
        public SaleListingsController(ISaleListingService saleListings) => _saleListings = saleListings;

        [HttpPost]
        public async Task<ActionResult<SaleListingDto>> Create(
            Guid assetId, [FromBody] SaleListingCreateRequest request, CancellationToken ct)
            => Ok(await _saleListings.CreateAsync(assetId, request, ct));

        [HttpPut]
        public async Task<ActionResult<SaleListingDto>> Update(
            Guid assetId, [FromBody] SaleListingUpdateRequest request, CancellationToken ct)
            => Ok(await _saleListings.UpdateAsync(assetId, request, ct));

        [HttpGet]
        public async Task<ActionResult<SaleListingDto>> GetByAsset(Guid assetId, CancellationToken ct)
            => Ok(await _saleListings.GetByAssetAsync(assetId, ct));

        [HttpPost("brokers")]
        public async Task<ActionResult<SaleListingDto>> AddBroker(
            Guid assetId, [FromBody] SaleListingBrokerRequest request, CancellationToken ct)
            => Ok(await _saleListings.AddBrokerAsync(assetId, request, ct));

        [HttpDelete("brokers/{brokerId:guid}")]
        public async Task<ActionResult<SaleListingDto>> RemoveBroker(
            Guid assetId, Guid brokerId, CancellationToken ct)
            => Ok(await _saleListings.RemoveBrokerAsync(assetId, brokerId, ct));

        [HttpPost("mark-sold")]
        public async Task<IActionResult> MarkSold(Guid assetId, CancellationToken ct)
        {
            await _saleListings.MarkSoldAsync(assetId, ct);
            return NoContent();
        }
    }
}

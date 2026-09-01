using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Route TOP-LEVEL (không nested dưới asset) — trang "Rao bán" tổng hợp ở sidebar,
    /// khác với SaleListingsController (route api/assets/{assetId}/sale-listing) phục vụ tab
    /// "Rao bán" trong chi tiết từng tài sản.</summary>
    [ApiController]
    [Authorize]
    [Route("api/sale-listings")]
    public sealed class SaleListingsOverviewController : ControllerBase
    {
        private readonly ISaleListingService _listings;
        public SaleListingsOverviewController(ISaleListingService listings) => _listings = listings;

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<MySaleListingDto>>> GetAll(CancellationToken ct)
            => Ok(await _listings.GetAllForCurrentUserAsync(ct));
    }
}

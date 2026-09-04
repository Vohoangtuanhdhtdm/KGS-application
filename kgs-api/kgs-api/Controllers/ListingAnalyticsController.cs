using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Bảng phân tích cho người đăng tin (nhiem vu 1.8).</summary>
    [ApiController]
    [Authorize]
    [Route("api/listing-analytics")]
    public sealed class ListingAnalyticsController : ControllerBase
    {
        private readonly IListingAnalyticsService _analytics;
        public ListingAnalyticsController(IListingAnalyticsService analytics) => _analytics = analytics;

        [HttpGet("summary")]
        public async Task<ActionResult<OwnerAnalyticsSummaryDto>> Summary(CancellationToken ct)
            => Ok(await _analytics.GetOwnerSummaryAsync(ct));

        [HttpGet("{listingId:guid}")]
        public async Task<ActionResult<ListingAnalyticsDto>> ForListing(Guid listingId, CancellationToken ct)
            => Ok(await _analytics.GetForListingAsync(listingId, ct));
    }
}

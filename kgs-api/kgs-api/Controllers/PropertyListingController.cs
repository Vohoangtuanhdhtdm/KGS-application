using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    [ApiController]
    [Route("api/property-listings")]
    public sealed class PropertyListingController : ControllerBase
    {
        private readonly IPropertyListingService _listings;
        public PropertyListingController(IPropertyListingService listings) => _listings = listings;

        // ---- CÔNG KHAI — không cần đăng nhập ----

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<ActionResult<PagedResult<PublicPropertySummaryDto>>> Search(
            [FromQuery] PublicPropertySearchQuery query, CancellationToken ct)
            => Ok(await _listings.SearchPublicAsync(query, ct));

        [HttpGet("{slug}")]
        [AllowAnonymous]
        public async Task<ActionResult<PublicPropertyDetailDto>> GetBySlug(string slug, CancellationToken ct)
            => Ok(await _listings.GetPublicBySlugAsync(slug, ct));

        // ---- CẦN ĐĂNG NHẬP — chủ tài sản quản lý tin của mình ----

        [HttpGet("my-listings")]
        [Authorize]
        public async Task<ActionResult<IReadOnlyList<OwnerListingDto>>> MyListings(CancellationToken ct)
            => Ok(await _listings.GetMyListingsAsync(ct));
    }

    // Endpoint tạo tin NESTED dưới asset, nhất quán với các endpoint Nhóm A/D khác.
    // PHẢI là class top-level (không lồng trong PropertyListingController): controller
    // discovery mặc định của ASP.NET Core bỏ qua class lồng nhau vì TypeInfo.IsPublic
    // trả về false với nested type → route không được đăng ký → 404.
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/property-listing")]
    public sealed class AssetPropertyListingController : ControllerBase
    {
        private readonly IPropertyListingService _listings;
        public AssetPropertyListingController(IPropertyListingService listings) => _listings = listings;

        [HttpPost]
        public async Task<ActionResult<OwnerListingDto>> Create(
            Guid assetId, [FromBody] CreateListingFromAssetRequest request, CancellationToken ct)
            => Ok(await _listings.CreateFromAssetAsync(assetId, request, ct));
    }
}

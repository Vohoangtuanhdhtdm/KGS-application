using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    // ============================================================
    // TIN ĐĂNG CÔNG KHAI — tìm kiếm & xem chi tiết, không cần đăng nhập
    // ============================================================
    [ApiController]
    [Route("api/listings")]
    public sealed class ListingsController : ControllerBase
    {
        private readonly IListingService _listings;
        private readonly IListingRetrievalService _retrieval;

        public ListingsController(IListingService listings, IListingRetrievalService retrieval)
        {
            _listings = listings; _retrieval = retrieval;
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<ActionResult<PagedResult<PublicListingSummaryDto>>> Search(
            [FromQuery] PublicListingSearchQuery query, CancellationToken ct)
            => Ok(await _listings.SearchPublicAsync(query, ct));

        /// <summary>Truy hồi có chọn nhánh. AI Agent gọi endpoint này ở Bước 2-3 sau khi
        /// Claude đã tách câu hỏi tự nhiên thành điều kiện; bộ đánh giá gọi nó ba lần với
        /// ba mode khác nhau trên cùng một truy vấn để dựng biểu đồ so sánh.</summary>
        [HttpGet("retrieve")]
        [AllowAnonymous]
        public async Task<ActionResult<IReadOnlyList<RetrievalHit>>> Retrieve(
            [FromQuery] RetrievalQuery query,
            [FromQuery] RetrievalMode mode = RetrievalMode.Hybrid,
            CancellationToken ct = default)
            => Ok(await _retrieval.SearchAsync(query, mode, ct));

        [HttpGet("{slug}")]
        [AllowAnonymous]
        public async Task<ActionResult<PublicListingDetailDto>> GetBySlug(string slug, CancellationToken ct)
            => Ok(await _listings.GetPublicBySlugAsync(slug, ct));

        // ---- Cần đăng nhập — chủ tài sản quản lý tin của mình ----

        [HttpGet("mine")]
        [Authorize]
        public async Task<ActionResult<IReadOnlyList<OwnerListingDto>>> MyListings(CancellationToken ct)
            => Ok(await _listings.GetMyListingsAsync(ct));

        [HttpPut("{listingId:guid}")]
        [Authorize]
        public async Task<ActionResult<OwnerListingDto>> Update(
            Guid listingId, [FromBody] UpdateListingRequest request, CancellationToken ct)
            => Ok(await _listings.UpdateAsync(listingId, request, ct));

        /// <summary>Đóng tin khi đã có khách / đã bán. Không xoá — giữ lượt xem và lịch sử.</summary>
        [HttpPost("{listingId:guid}/close")]
        [Authorize]
        public async Task<IActionResult> Close(Guid listingId, CancellationToken ct)
        {
            await _listings.CloseAsync(listingId, ct);
            return NoContent();
        }
    }

    // ============================================================
    // Đăng tin — lồng dưới tài sản, nhất quán với các endpoint khác
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/assets/{assetId:guid}/listings")]
    public sealed class AssetListingsController : ControllerBase
    {
        private readonly IListingService _listings;
        public AssetListingsController(IListingService listings) => _listings = listings;

        /// <summary>Đăng tin cho nguyên căn (AssetUnitId = null) hoặc cho một phòng cụ thể.</summary>
        [HttpPost]
        public async Task<ActionResult<OwnerListingDto>> Create(
            Guid assetId, [FromBody] CreateListingRequest request, CancellationToken ct)
            => Ok(await _listings.CreateAsync(assetId, request, ct));

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<OwnerListingDto>>> GetByAsset(
            Guid assetId, CancellationToken ct)
            => Ok(await _listings.GetByAssetAsync(assetId, ct));
    }
}

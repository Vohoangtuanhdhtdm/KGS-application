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

        // ---- Luồng đăng tin trực tiếp: tạo nháp → thêm ảnh → gửi duyệt ----

        /// <summary>Đăng tin không cần tạo tài sản trước. Trả về bản nháp; ảnh và bước gửi
        /// duyệt đi ở hai lời gọi sau, để form hiện được tiến trình tải ảnh và để người
        /// đăng bỏ dở giữa chừng vẫn không mất dữ liệu.</summary>
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<OwnerListingDto>> CreateDirect(
            [FromBody] CreateListingDirectRequest request, CancellationToken ct)
            => Ok(await _listings.CreateDirectAsync(request, ct));

        [HttpGet("{listingId:guid}/images")]
        [Authorize]
        public async Task<ActionResult<IReadOnlyList<ListingImageDto>>> GetImages(
            Guid listingId, CancellationToken ct)
            => Ok(await _listings.GetImagesAsync(listingId, ct));

        [HttpPost("{listingId:guid}/images")]
        [Authorize]
        [RequestSizeLimit(120_000_000)]   // ~10MB × 10 ảnh, đệm an toàn
        public async Task<ActionResult<IReadOnlyList<ListingImageDto>>> AddImages(
            Guid listingId, IFormFileCollection files, CancellationToken ct)
            => Ok(await _listings.AddImagesAsync(listingId, files, ct));

        [HttpDelete("{listingId:guid}/images/{imageId:guid}")]
        [Authorize]
        public async Task<IActionResult> RemoveImage(Guid listingId, Guid imageId, CancellationToken ct)
        {
            await _listings.RemoveImageAsync(listingId, imageId, ct);
            return NoContent();
        }

        [HttpPost("{listingId:guid}/submit")]
        [Authorize]
        public async Task<ActionResult<OwnerListingDto>> Submit(Guid listingId, CancellationToken ct)
            => Ok(await _listings.SubmitAsync(listingId, ct));

        // ---- Vòng đời tin đăng ----

        /// <summary>Nạp lại tin vào biểu mẫu: dùng cho cả soạn tiếp bản nháp lẫn sửa tin.</summary>
        [HttpGet("{listingId:guid}/edit")]
        [Authorize]
        public async Task<ActionResult<EditListingDto>> GetForEdit(Guid listingId, CancellationToken ct)
            => Ok(await _listings.GetForEditAsync(listingId, ct));

        /// <summary>Đẩy tin lên đầu danh sách. Giới hạn 24 giờ một lần.</summary>
        [HttpPost("{listingId:guid}/bump")]
        [Authorize]
        public async Task<ActionResult<OwnerListingDto>> Bump(Guid listingId, CancellationToken ct)
            => Ok(await _listings.BumpAsync(listingId, ct));

        /// <summary>Mở lại tin đã đóng — quay về bản nháp để sửa rồi gửi duyệt lại.</summary>
        [HttpPost("{listingId:guid}/reopen")]
        [Authorize]
        public async Task<ActionResult<OwnerListingDto>> Reopen(Guid listingId, CancellationToken ct)
            => Ok(await _listings.ReopenAsync(listingId, ct));

        /// <summary>Xoá hẳn — chỉ với bản nháp.</summary>
        [HttpDelete("{listingId:guid}")]
        [Authorize]
        public async Task<IActionResult> DeleteDraft(Guid listingId, CancellationToken ct)
        {
            await _listings.DeleteDraftAsync(listingId, ct);
            return NoContent();
        }

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

using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    // ============================================================
    // E1 — TIN ĐÃ LƯU (phía người đi tìm thuê)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/saved-listings")]
    public sealed class SavedListingsController : ControllerBase
    {
        private readonly IMarketplaceEngagementService _engagement;
        public SavedListingsController(IMarketplaceEngagementService engagement) => _engagement = engagement;

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<SavedListingDto>>> GetSaved(CancellationToken ct)
            => Ok(await _engagement.GetSavedAsync(ct));

        /// <summary>Idempotent — lưu lại tin đã lưu trả 204 chứ không báo lỗi.</summary>
        [HttpPost("{propertyId:int}")]
        public async Task<IActionResult> Save(int propertyId, CancellationToken ct)
        {
            await _engagement.SaveAsync(propertyId, ct);
            return NoContent();
        }

        [HttpDelete("{propertyId:int}")]
        public async Task<IActionResult> Unsave(int propertyId, CancellationToken ct)
        {
            await _engagement.UnsaveAsync(propertyId, ct);
            return NoContent();
        }
    }

    // ============================================================
    // E2 — YÊU CẦU XEM NHÀ
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/inquiries")]
    public sealed class InquiriesController : ControllerBase
    {
        private readonly IMarketplaceEngagementService _engagement;
        public InquiriesController(IMarketplaceEngagementService engagement) => _engagement = engagement;

        /// <summary>Hộp thư của chủ tin — các yêu cầu nhận được.</summary>
        [HttpGet("received")]
        public async Task<ActionResult<IReadOnlyList<ReceivedInquiryDto>>> Received(
            [FromQuery] InquiryStatus? status, CancellationToken ct)
            => Ok(await _engagement.GetReceivedInquiriesAsync(status, ct));

        /// <summary>Yêu cầu người đi tìm thuê đã gửi.</summary>
        [HttpGet("sent")]
        public async Task<ActionResult<IReadOnlyList<SentInquiryDto>>> Sent(CancellationToken ct)
            => Ok(await _engagement.GetSentInquiriesAsync(ct));

        [HttpPut("{inquiryId:guid}/status")]
        public async Task<ActionResult<ReceivedInquiryDto>> UpdateStatus(
            Guid inquiryId, [FromBody] UpdateInquiryStatusRequest request, CancellationToken ct)
            => Ok(await _engagement.UpdateInquiryStatusAsync(inquiryId, request, ct));

        /// <summary>Cầu nối marketplace → nghiệp vụ: sinh ContactParty từ hồ sơ người gửi.
        /// Client dùng contactPartyId trả về để mở màn hình tạo hợp đồng đã điền sẵn đối tác.</summary>
        [HttpPost("{inquiryId:guid}/convert")]
        public async Task<ActionResult<ConvertInquiryResultDto>> Convert(Guid inquiryId, CancellationToken ct)
            => Ok(await _engagement.ConvertInquiryAsync(inquiryId, ct));
    }

    // ============================================================
    // Gửi yêu cầu — lồng dưới tin đăng, nhất quán với các endpoint khác
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/property-listings/{slug}/inquiries")]
    public sealed class PropertyInquiryController : ControllerBase
    {
        private readonly IMarketplaceEngagementService _engagement;
        public PropertyInquiryController(IMarketplaceEngagementService engagement) => _engagement = engagement;

        [HttpPost]
        public async Task<ActionResult<SentInquiryDto>> Create(
            string slug, [FromBody] CreateInquiryRequest request, CancellationToken ct)
            => Ok(await _engagement.CreateInquiryAsync(slug, request, ct));
    }
}

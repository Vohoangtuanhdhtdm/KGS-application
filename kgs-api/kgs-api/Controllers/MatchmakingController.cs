using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // GHÉP ĐÔI HAI CHIỀU — chủ tin mời người đang tìm nhà phù hợp
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/matchmaking")]
    public sealed class MatchmakingController : ControllerBase
    {
        private readonly IMatchmakingService _service;
        public MatchmakingController(IMatchmakingService service) => _service = service;

        /// <summary>Số người đang tìm nhà khớp với từng tin của tôi.</summary>
        [HttpGet("my-listings/demand-counts")]
        public async Task<ActionResult<IReadOnlyList<ListingDemandCountDto>>> DemandCounts(CancellationToken ct)
            => Ok(await _service.GetDemandCountsAsync(ct));

        /// <summary>Các nhu cầu ẩn danh khớp một tin của tôi.</summary>
        [HttpGet("listings/{listingId:guid}/demands")]
        public async Task<ActionResult<IReadOnlyList<AnonymousDemandDto>>> Demands(
            Guid listingId, CancellationToken ct)
            => Ok(await _service.GetDemandsForListingAsync(listingId, ct));

        [HttpPost("listings/{listingId:guid}/invitations")]
        public async Task<ActionResult<AnonymousDemandDto>> Invite(
            Guid listingId, [FromBody] InviteRequest request, CancellationToken ct)
            => Ok(await _service.InviteAsync(listingId, request, ct));

        /// <summary>Hộp lời mời của người tìm.</summary>
        [HttpGet("invitations")]
        public async Task<ActionResult<IReadOnlyList<SeekerInvitationDto>>> MyInvitations(CancellationToken ct)
            => Ok(await _service.GetMyInvitationsAsync(ct));

        [HttpPost("invitations/{id:guid}/respond")]
        public async Task<ActionResult<SeekerInvitationDto>> Respond(
            Guid id, [FromBody] RespondInvitationRequest request, CancellationToken ct)
            => Ok(await _service.RespondAsync(id, request, ct));
    }
}

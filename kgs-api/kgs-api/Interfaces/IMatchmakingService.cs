using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    /// <summary>Ghép đôi hai chiều: chủ tin thấy nhu cầu ẩn danh khớp tin của mình và mời
    /// xem nhà; người tìm nhận hoặc từ chối.</summary>
    public interface IMatchmakingService
    {
        Task<IReadOnlyList<ListingDemandCountDto>> GetDemandCountsAsync(CancellationToken ct = default);
        Task<IReadOnlyList<AnonymousDemandDto>> GetDemandsForListingAsync(Guid listingId, CancellationToken ct = default);
        Task<AnonymousDemandDto> InviteAsync(Guid listingId, InviteRequest request, CancellationToken ct = default);

        Task<IReadOnlyList<SeekerInvitationDto>> GetMyInvitationsAsync(CancellationToken ct = default);
        Task<SeekerInvitationDto> RespondAsync(Guid invitationId, RespondInvitationRequest request, CancellationToken ct = default);
    }
}

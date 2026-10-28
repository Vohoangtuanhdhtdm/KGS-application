namespace kgs_api.Domain.Rules
{
    /// <summary>Ghép đôi hai chiều trên trang tổng quan quản trị: có ai dùng không, và có hiệu quả không.
    /// Tỉ lệ tính trên số lời mời đã gửi trong kỳ (0–1).</summary>
    public sealed record MatchmakingStatsDto(
        int OpenDemands, int InvitationsSent, int Accepted, int WithOffer,
        double AcceptRate, double OfferRate,
        /// <summary>Nhu cầu đang chờ quản trị duyệt (DemandScreening giữ lại).</summary>
        int PendingReview = 0);

    public static class MatchmakingStats
    {
        /// <summary>Chưa gửi lời mời nào thì mọi tỉ lệ là 0, không chia cho 0.</summary>
        public static MatchmakingStatsDto From(int openDemands, int sent, int accepted, int withOffer, int pendingReview = 0)
            => new(openDemands, sent, accepted, withOffer,
                sent == 0 ? 0 : (double)accepted / sent,
                sent == 0 ? 0 : (double)withOffer / sent,
                pendingReview);
    }
}

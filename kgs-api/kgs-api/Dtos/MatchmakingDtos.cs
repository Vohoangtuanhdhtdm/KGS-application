using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // GHÉP ĐÔI HAI CHIỀU — chủ tin thấy nhu cầu ẩn danh và mời xem nhà
    // ============================================================

    /// <summary>Bật/tắt cho chủ tin phù hợp thấy một bộ lọc đã lưu.</summary>
    public sealed record SetDiscoverableRequest(
        bool Enabled,
        [MaxLength(300)] string? Note);

    /// <summary>Số nhu cầu đang khớp với từng tin của chủ tin — huy hiệu
    /// "5 người đang tìm nhà như tin này" ở trang Tin của tôi.</summary>
    public sealed record ListingDemandCountDto(Guid ListingId, int Count);

    /// <summary>Một nhu cầu tìm nhà, như chủ tin nhìn thấy: CHỈ tiêu chí và lời nhắn.
    ///
    /// Không có tên, email, số điện thoại, cũng không có toạ độ điểm người tìm ghim (điểm đó
    /// thường là chỗ làm hoặc nhà người thân). Thay vào đó là DẢI khoảng cách thô từ điểm ấy tới
    /// tin này — đủ để chủ tin biết "người này tìm quanh đây", không đủ để biết họ ở đâu.</summary>
    public sealed record AnonymousDemandDto(
        Guid DemandId,
        /// <summary>Bí danh ổn định ("Người tìm #7F3A") để chủ tin phân biệt các nhu cầu.</summary>
        string Alias,
        PublicListingSearchQuery Criteria,
        /// <summary>Cận trên của dải khoảng cách từ điểm người tìm ghim tới tin này: 1000, 2000,
        /// 5000 hoặc 10000 (= trên 5 km). Cố tình thô để không đo tam giác ra được vị trí.</summary>
        double? CenterDistanceMeters,
        string? Note,
        DateTime ActiveSince,
        InvitationStatus? InvitationStatus,
        DateTime? InvitedAt,
        bool InvitationExpired);

    public sealed record InviteRequest(
        Guid DemandId,
        [MaxLength(500)] string? Message);

    /// <summary>Lời mời trong hộp thư của người tìm.</summary>
    public sealed record SeekerInvitationDto(
        Guid Id,
        Guid ListingId,
        string ListingSlug,
        string ListingTitle,
        string? ThumbnailUrl,
        decimal Price,
        ListingType Type,
        PaymentCycle? RentPaymentCycle,
        string City,
        string District,
        string OwnerName,
        string? Message,
        /// <summary>Tên bộ lọc đã khớp — "vì sao tôi nhận được lời mời này". Null khi bộ lọc
        /// đã bị xoá.</summary>
        string? DemandName,
        InvitationStatus Status,
        bool Expired,
        DateTime CreatedAt,
        DateTime? RespondedAt);

    public sealed record RespondInvitationRequest(
        bool Accept,
        [MaxLength(1000)] string? Message,
        DateTime? PreferredViewingAt);
}

using CloudinaryDotNet.Actions;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // A6. ASSET UNIT
    // ============================================================
    public sealed record AssetUnitRequest(
        [Required, MaxLength(100)] string Name,
        int? FloorNumber,
        double? Area,
        string? Notes,
        /// <summary>null = giữ nguyên. Chủ nhà tự đánh dấu "đã có người / đang sửa" để mô hình
        /// 3D tô đúng màu.</summary>
        UnitStatus? Status = null);

    public sealed record AssetUnitDto(
        Guid Id, string Name, int? FloorNumber, double? Area, UnitStatus Status, string? Notes);

    // ============================================================
    // E1. SAVED LISTING — tin đã lưu (phía người đi tìm thuê)
    // ============================================================
    public sealed record SavedListingDto(
        Guid ListingId, string Slug, string Title, ListingType Type,
        decimal Price, PaymentCycle? RentPaymentCycle,
        string City, string District, int? Bedrooms, double? Area,
        string? ThumbnailUrl, DateTime SavedAt);

    // ============================================================
    // E2. LISTING INQUIRY — yêu cầu xem nhà
    // ============================================================
    public sealed record CreateInquiryRequest(
        [MaxLength(1000)] string? Message,
        DateTime? PreferredViewingAt);

    public sealed record UpdateInquiryStatusRequest(InquiryStatus Status);

    /// <summary>Yêu cầu chủ nhà NHẬN được. Có thông tin liên hệ của người gửi vì
    /// họ đã chủ động gửi yêu cầu — khác với tin đăng công khai.</summary>
    public sealed record ReceivedInquiryDto(
        Guid Id, Guid ListingId, string ListingSlug, string ListingTitle,
        string FromUserName, string? FromUserPhone, string? FromUserEmail,
        string? Message, DateTime? PreferredViewingAt,
        InquiryStatus Status, DateTime CreatedAt,
        /// <summary>Ưu đãi riêng chép từ lời mời mà người này đã nhận.</summary>
        decimal? OfferPrice = null, string? OfferNote = null);

    /// <summary>Yêu cầu người tìm thuê ĐÃ GỬI. Không kèm liên hệ của chủ nhà —
    /// thông tin đó đã có sẵn trên trang chi tiết tin đăng.</summary>
    public sealed record SentInquiryDto(
        Guid Id, Guid ListingId, string ListingSlug, string ListingTitle,
        string? ThumbnailUrl, string? Message, DateTime? PreferredViewingAt,
        InquiryStatus Status, DateTime CreatedAt,
        decimal? OfferPrice = null, string? OfferNote = null);
}

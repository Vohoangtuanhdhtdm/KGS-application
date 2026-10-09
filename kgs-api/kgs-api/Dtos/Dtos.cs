using CloudinaryDotNet.Actions;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // SHARED
    // ============================================================
    public sealed record AddressDto(
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [Required, MaxLength(100)] string Ward,
        [MaxLength(500)] string Detail);

    public sealed record AssetMapPinDto(
        Guid Id,
        string Name,
        AssetDomainType Type,
        AssetOwnershipType OwnershipType,
        AssetStatus Status,
        string City,
        string District,
        decimal? CurrentValue,
        string? ThumbnailUrl,
        /// <summary>Số tin đăng đang chờ duyệt hoặc đang hiển thị của tài sản này.</summary>
        int ListingCount,
        double? Latitude,    // null nếu tài sản chưa gắn vị trí — KHÔNG loại tài sản này khỏi kết quả
        double? Longitude);  // null nếu tài sản chưa gắn vị trí


    /// <summary>Client luôn gửi/nhận lat-lng; chuyển đổi sang NTS Point nằm trong service.</summary>
    public sealed record GeoPointDto(
        [Range(-90, 90)] double Latitude,
        [Range(-180, 180)] double Longitude);

    public sealed record StoredFileDto(string Url, string? FileName, string? ContentType, long? SizeBytes);

    // ============================================================
    // A. ASSET
    // ============================================================
    public sealed record AssetCreateRequest(
        [Required, MaxLength(255)] string Name,
        AssetDomainType TypeProperty,
        AssetOwnershipType OwnershipType,
        [Required] AddressDto Address,
        GeoPointDto? Location,
        [Range(0, double.MaxValue)] double? Area,
        [Range(0, (double)decimal.MaxValue)] decimal? CurrentValue,
        DateTime? AcquisitionDate,
        string? Notes,
        [Range(0, 200)] int? Floors,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState,
        [Range(0, 1000)] double? Frontage);

    public sealed record AssetUpdateRequest(
        [Required, MaxLength(255)] string Name,
        AssetDomainType TypeProperty,
        AssetStatus Status,
        [Required] AddressDto Address,
        GeoPointDto? Location,
        double? Area,
        decimal? CurrentValue,
        DateTime? AcquisitionDate,
        string? Notes,
        [Range(0, 200)] int? Floors,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState,
        [Range(0, 1000)] double? Frontage
        );

    public sealed record AssetSearchQuery(
        string? Keyword,
        AssetDomainType? TypeProperty,
        AssetStatus? Status,
        AssetOwnershipType? OwnershipType,
        string? City,
        int Page = 1,
        int PageSize = 20);

    public sealed record NearbyQuery(
        [Range(-90, 90)] double Latitude,
        [Range(-180, 180)] double Longitude,
        [Range(1, 50_000)] double RadiusMeters = 2000,
        [Range(1, 100)] int Limit = 20);

    public sealed record AssetSummaryDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetOwnershipType OwnershipType, AssetStatus Status,
        string City, string District, decimal? CurrentValue, string? ThumbnailUrl, int ListingCount);

    public sealed record AssetNearbyDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetStatus Status,
        double Latitude, double Longitude, double DistanceMeters);

    public sealed record AssetDetailDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetOwnershipType OwnershipType, AssetStatus Status,
        AddressDto Address, GeoPointDto? Location, double? Area,
        decimal? CurrentValue, DateTime? AcquisitionDate, string? Notes,
        StoredFileDto? Thumbnail, int ListingCount,
        int UnitCount, DateTime CreatedAt, DateTime? UpdatedAt, int? Floors, int? Bedrooms, int? Bathrooms,
        string? HouseDirection, string? LegalStatus, string? FurnitureState, double? Frontage);

    // ============================================================
    // A4–A5. MEDIA & DOCUMENTS
    // ============================================================
    public sealed record AssetMediaUploadRequest(IFormFileCollection Files, string? Caption, DateTime? TakenAt);
    public sealed record AssetMediaDto(Guid Id, StoredFileDto File, string? Caption, DateTime TakenAt, int SortOrder);

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
        InquiryStatus Status, DateTime CreatedAt);

    /// <summary>Yêu cầu người tìm thuê ĐÃ GỬI. Không kèm liên hệ của chủ nhà —
    /// thông tin đó đã có sẵn trên trang chi tiết tin đăng.</summary>
    public sealed record SentInquiryDto(
        Guid Id, Guid ListingId, string ListingSlug, string ListingTitle,
        string? ThumbnailUrl, string? Message, DateTime? PreferredViewingAt,
        InquiryStatus Status, DateTime CreatedAt);
}

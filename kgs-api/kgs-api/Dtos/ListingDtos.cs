using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    /// <summary>Tạo tin đăng từ một tài sản.
    ///
    /// Sau khi gộp Property vào Asset, request này KHÔNG còn nhận các trường mô tả vật lý
    /// (số tầng, phòng ngủ, hướng nhà, pháp lý, nội thất, mặt tiền). Chúng thuộc về tài sản,
    /// sửa ở màn hình tài sản — tin đăng luôn đọc giá trị mới nhất. Trước đây chúng được
    /// sao chép sang Property lúc đăng tin rồi đóng băng ở đó, nên sửa tài sản không làm
    /// tin đăng đổi theo.</summary>
    public sealed record CreateListingRequest(
        ListingType Type,
        /// <summary>null = đăng nguyên căn; có giá trị = đăng riêng một tầng/phòng.</summary>
        Guid? AssetUnitId,
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,
        List<Guid> SelectedAssetMediaIds);

    public sealed record UpdateListingRequest(
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle);

    public sealed record PublicListingSearchQuery(
        ListingType? Type,
        string? City,
        string? District,
        decimal? PriceMin,
        decimal? PriceMax,
        int? BedroomsMin,
        string? Keyword,
        double? Latitude,
        double? Longitude,
        double? RadiusMeters,
        int Page = 1,
        int PageSize = 20);

    public sealed record PublicListingSummaryDto(
        Guid Id, string Slug, string Title, ListingType Type, decimal Price,
        PaymentCycle? RentPaymentCycle, string City, string District,
        int? Bedrooms, int? Bathrooms, double? Area, string? ThumbnailUrl,
        double? Latitude, double? Longitude, double? DistanceMeters,
        /// <summary>Tên phòng khi tin đăng cho một phòng cụ thể, null khi đăng nguyên căn.</summary>
        string? UnitName,
        DateTime? PublishedAt);

    public sealed record PublicListingDetailDto(
        Guid Id, string Slug, string Title, string Description, ListingType Type,
        decimal Price, PaymentCycle? RentPaymentCycle,
        string City, string District, string Ward, string AddressDetail,
        double? Area, double? Frontage, int? Floors, int? Bedrooms, int? Bathrooms,
        string? HouseDirection, string? LegalStatus, string? FurnitureState,
        AssetDomainType AssetType, string AssetTypeLabel, string? UnitName,
        double? Latitude, double? Longitude,
        IReadOnlyList<string> ImageUrls, int ViewCount, DateTime? PublishedAt,
        string OwnerName, string OwnerPhone);   // hiện trực tiếp theo quyết định đã chốt

    public sealed record OwnerListingDto(
        Guid Id, string? Slug, string Title, ListingType Type, ListingStatus Status,
        decimal Price, PaymentCycle? RentPaymentCycle, int ViewCount,
        DateTime CreatedAt, DateTime? PublishedAt,
        Guid AssetId, string AssetName, string? UnitName, string? ModerationNote);
}

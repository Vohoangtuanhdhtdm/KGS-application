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
        List<Guid> SelectedAssetMediaIds,
        ListingTermsDto? Terms,
        List<string>? Amenities);

    /// <summary>Điều kiện thuê. Mọi trường nullable — null nghĩa là chủ tin CHƯA KHAI,
    /// khác hẳn với false (đã khai là không). Bộ lọc chỉ khớp khi khai tường minh.</summary>
    public sealed record ListingTermsDto(
        [Range(0, 12)] int? DepositMonths,
        decimal? ElectricityPrice,
        decimal? WaterPrice,
        WaterPricingMode? WaterPricing,
        decimal? ServiceFee,
        decimal? ParkingFee,
        decimal? InternetFee,
        [Range(1, 60)] int? MinLeaseMonths,
        DateTime? AvailableFrom,
        [Range(1, 20)] int? MaxOccupants,
        bool? PetsAllowed,
        bool? CurfewFree,
        bool? SharedWithOwner,
        bool? CookingAllowed);

    public sealed record UpdateListingRequest(
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,
        ListingTermsDto? Terms,
        List<string>? Amenities);

    /// <summary>Đăng tin TRỰC TIẾP — không cần tạo tài sản trước.
    ///
    /// Đây là luồng chính của nền tảng môi giới. Luồng cũ qua
    /// <c>POST /api/assets/{id}/listings</c> vẫn giữ cho Giai đoạn 4, khi người dùng đã có
    /// sẵn danh mục tài sản và muốn đăng tin cho một phòng cụ thể.
    ///
    /// Asset được tạo NGẦM từ chính dữ liệu của tin. Người đăng không bao giờ nhìn thấy
    /// khái niệm "tài sản" — họ chỉ đang đăng một tin.</summary>
    public sealed record CreateListingDirectRequest(
        // ---- Nội dung tin ----
        ListingType Type,
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,

        // ---- Bất động sản: dùng để tạo Asset ngầm ----
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [Required, MaxLength(100)] string Ward,
        [MaxLength(500)] string? AddressDetail,
        [Range(-90, 90)] double? Latitude,
        [Range(-180, 180)] double? Longitude,
        AssetDomainType PropertyType,
        [Range(0, double.MaxValue)] double? Area,
        [Range(0, 1000)] double? Frontage,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [Range(0, 200)] int? Floors,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState,

        // ---- Điều kiện thuê ----
        ListingTermsDto? Terms,
        List<string>? Amenities);

    public sealed record ListingImageDto(Guid Id, string Url, int SortOrder);

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

        // ---- Bộ lọc điều kiện thuê ----
        // Đây chính là các hard filter mà AI Agent sinh ra ở Bước 1 rồi truyền thẳng vào đây.
        // Xây sẵn ở tầng search để agent không phải dựng đường truy vấn riêng.

        /// <summary>Trần TỔNG chi phí cố định hàng tháng = giá thuê + phí dịch vụ + gửi xe +
        /// internet. Điện nước tính theo mức dùng nên không cộng được vào đây.
        /// Người thuê so sánh tổng chi phí, không so giá thuê trần trụi.</summary>
        decimal? TotalCostMax,
        bool? PetsAllowed,
        bool? CurfewFree,
        bool? SharedWithOwner,
        /// <summary>Chỉ lấy tin dọn vào được trước ngày này.</summary>
        DateTime? AvailableBy,
        /// <summary>Tin phải có ĐỦ mọi tiện nghi trong danh sách (phép AND).</summary>
        List<string>? Amenities,

        int Page = 1,
        int PageSize = 20);

    public sealed record PublicListingSummaryDto(
        Guid Id, string Slug, string Title, ListingType Type, decimal Price,
        PaymentCycle? RentPaymentCycle, string City, string District,
        int? Bedrooms, int? Bathrooms, double? Area, string? ThumbnailUrl,
        double? Latitude, double? Longitude, double? DistanceMeters,
        /// <summary>Tên phòng khi tin đăng cho một phòng cụ thể, null khi đăng nguyên căn.</summary>
        string? UnitName,
        DateTime? PublishedAt,
        /// <summary>Tổng chi phí cố định hàng tháng — số người thuê thực sự so sánh.</summary>
        decimal TotalMonthlyCost,
        int? DepositMonths,
        bool? PetsAllowed,
        IReadOnlyList<string> Amenities);

    public sealed record PublicListingDetailDto(
        Guid Id, string Slug, string Title, string Description, ListingType Type,
        decimal Price, PaymentCycle? RentPaymentCycle,
        string City, string District, string Ward, string AddressDetail,
        double? Area, double? Frontage, int? Floors, int? Bedrooms, int? Bathrooms,
        string? HouseDirection, string? LegalStatus, string? FurnitureState,
        AssetDomainType AssetType, string AssetTypeLabel, string? UnitName,
        double? Latitude, double? Longitude,
        IReadOnlyList<string> ImageUrls, int ViewCount, DateTime? PublishedAt,
        ListingTermsDto Terms, IReadOnlyList<string> Amenities, decimal TotalMonthlyCost,
        string OwnerName, string OwnerPhone);   // hiện trực tiếp theo quyết định đã chốt

    public sealed record OwnerListingDto(
        Guid Id, string? Slug, string Title, ListingType Type, ListingStatus Status,
        decimal Price, PaymentCycle? RentPaymentCycle, int ViewCount,
        DateTime CreatedAt, DateTime? PublishedAt,
        Guid AssetId, string AssetName, string? UnitName, string? ModerationNote,
        /// <summary>0–100. Tin càng đầy đủ dữ kiện càng được bộ lọc và AI Agent tìm thấy —
        /// hiển thị con số này là cách tạo động lực thật cho chủ tin, thay vì bắt ép nhập.</summary>
        int CompletenessPercent);
}

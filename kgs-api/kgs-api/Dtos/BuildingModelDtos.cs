using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // MÔ HÌNH TOÀ NHÀ 3D — "Toà nhà → Tầng → Căn"
    // ============================================================

    /// <summary>Tin đăng gắn với một căn — để người tìm bấm vào căn là thấy tin và liên hệ.</summary>
    public sealed record BuildingUnitListingDto(
        string Slug, string Title, decimal Price, ListingType Type, PaymentCycle? RentPaymentCycle);

    public sealed record BuildingUnitDto(
        Guid Id,
        string Name,
        int? Floor,
        double? Area,
        UnitStatus Status,
        /// <summary>Tin đang hiển thị của căn này, nếu có.</summary>
        BuildingUnitListingDto? Listing);

    public sealed record BuildingModelDto(
        Guid AssetId,
        string AssetName,
        /// <summary>Đường viền [lng, lat]. Rỗng khi chưa dựng.</summary>
        List<double[]> Footprint,
        int Floors,
        double FloorHeightMeters,
        bool Published,
        List<BuildingUnitDto> Units,
        /// <summary>Căn của tin đang xem (trang chi tiết tin) — để camera và khung chọn đưa tới đó.</summary>
        Guid? FocusUnitId,
        /// <summary>Vị trí tài sản — để xưởng dựng tự lấy khung toà nhà trên bản đồ tại đây.</summary>
        double? Latitude,
        double? Longitude);

    /// <summary>Một tin đang hiển thị trong toà nhà — cho cửa sổ bấm vào toà nhà trên bản đồ tìm kiếm.</summary>
    public sealed record BuildingListingPreviewDto(
        string Slug, string Title, decimal Price, ListingType Type, PaymentCycle? RentPaymentCycle,
        string? UnitName);

    /// <summary>Toà nhà có mô hình công khai, hiện thành khối 3D trên bản đồ tìm kiếm.</summary>
    public sealed record MapBuildingDto(
        Guid AssetId,
        string Address,
        List<double[]> Footprint,
        int Floors,
        double FloorHeightMeters,
        int UnitCount,
        int VacantCount,
        /// <summary>Tổng số tin đang hiển thị (khớp loại tin đang tìm, nếu có).</summary>
        int ListingCount,
        /// <summary>Vài tin rẻ nhất để xem nhanh.</summary>
        List<BuildingListingPreviewDto> Listings);

    public sealed record SaveBuildingModelRequest(
        [Required] List<double[]> Footprint,
        [Range(1, 100)] int Floors,
        [Range(2.4, 8)] double FloorHeightMeters,
        bool Published);
}

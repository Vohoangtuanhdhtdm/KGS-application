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

    public sealed record SaveBuildingModelRequest(
        [Required] List<double[]> Footprint,
        [Range(1, 100)] int Floors,
        [Range(2.4, 8)] double FloorHeightMeters,
        bool Published);
}

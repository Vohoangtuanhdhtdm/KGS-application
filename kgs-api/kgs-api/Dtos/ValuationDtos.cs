using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace kgs_api.Dtos
{
    /// <summary>Yêu cầu định giá gửi từ biểu mẫu đăng tin.
    ///
    /// Chỉ diện tích và địa chỉ là bắt buộc. Bắt khai đủ mới định giá được thì tính năng
    /// này gần như không bao giờ dùng được — tin đăng thật luôn thiếu vài mục.</summary>
    public sealed record ValuationRequest(
        [Range(1, 10_000)] double Area,
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [MaxLength(100)] string? Ward,
        [MaxLength(100)] string? PropertyType,
        [MaxLength(50)] string? HouseDirection,
        [Range(0, 50)] double? Bedrooms,
        [Range(0, 50)] double? Bathrooms,
        [Range(0, 100)] double? Floors,
        [Range(0, 200)] double? Frontage);

    /// <summary>Kết quả định giá.
    ///
    /// Luôn kèm khoảng và mức tin cậy, không bao giờ chỉ một con số: người đọc mặc định coi
    /// một con số đơn lẻ là chính xác tới từng đồng, trong khi mô hình có sai số điển hình
    /// cỡ chục phần trăm.</summary>
    public sealed record ValuationResult(
        decimal Price,
        decimal PriceLow,
        decimal PriceHigh,
        decimal PricePerM2,
        /// <summary>"cao" | "trung bình" | "thấp".</summary>
        string Confidence,
        decimal? AreaMedianPricePerM2,
        int AreaSampleSize,
        IReadOnlyList<string> Notes);

    // ---- Hình dạng dây với dịch vụ Python ----
    //
    // Tách riêng khỏi DTO hướng ra ngoài: dịch vụ Python dùng snake_case và từ vựng của bộ
    // dữ liệu ("province", "bedroom_count"), còn API của ta dùng từ vựng của sản phẩm
    // ("city", "bedrooms"). Trộn hai thứ vào một record nghĩa là một trong hai bên phải nói
    // ngôn ngữ của bên kia, và sau này đổi mô hình sẽ rò rỉ ra tận giao diện.

    internal sealed record MlValuationRequest(
        [property: JsonPropertyName("area")] double Area,
        [property: JsonPropertyName("province")] string Province,
        [property: JsonPropertyName("district")] string District,
        [property: JsonPropertyName("ward")] string? Ward,
        [property: JsonPropertyName("property_type")] string? PropertyType,
        [property: JsonPropertyName("house_direction")] string? HouseDirection,
        [property: JsonPropertyName("bedroom_count")] double? BedroomCount,
        [property: JsonPropertyName("bathroom_count")] double? BathroomCount,
        [property: JsonPropertyName("floor_count")] double? FloorCount,
        [property: JsonPropertyName("frontage_width")] double? FrontageWidth);

    internal sealed record MlValuationResponse(
        [property: JsonPropertyName("price")] decimal Price,
        [property: JsonPropertyName("price_low")] decimal PriceLow,
        [property: JsonPropertyName("price_high")] decimal PriceHigh,
        [property: JsonPropertyName("price_per_m2")] decimal PricePerM2,
        [property: JsonPropertyName("confidence")] string Confidence,
        [property: JsonPropertyName("area_median_price_per_m2")] decimal? AreaMedianPricePerM2,
        [property: JsonPropertyName("area_sample_size")] int AreaSampleSize,
        [property: JsonPropertyName("notes")] List<string>? Notes);

    public sealed record ValuationModelInfo(
        bool Available,
        string? TrainedAt,
        int? RowsFit,
        /// <summary>Sai số phần trăm trung vị trên tập kiểm tra.</summary>
        double? Mdape,
        /// <summary>Tỉ lệ dự đoán nằm trong sai số 10%.</summary>
        double? Ppe10,
        double? Ppe20);

    internal sealed record MlModelInfo(
        [property: JsonPropertyName("loaded")] bool Loaded,
        [property: JsonPropertyName("trained_at")] string? TrainedAt,
        [property: JsonPropertyName("rows_fit")] int? RowsFit,
        [property: JsonPropertyName("mdape")] double? Mdape,
        [property: JsonPropertyName("ppe10")] double? Ppe10,
        [property: JsonPropertyName("ppe20")] double? Ppe20);
}

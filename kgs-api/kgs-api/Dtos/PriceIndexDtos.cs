using System.Text.Json.Serialization;

namespace kgs_api.Dtos
{
    /// <summary>Một điểm trên chuỗi chỉ số giá theo tuần.</summary>
    public sealed record PriceIndexPoint(
        string WeekStart,
        /// <summary>Tuần gốc = 100. Đây là mức TƯƠNG ĐỐI, không phải giá tuyệt đối.</summary>
        double Index,
        int Count,
        /// <summary>Biên sai số xấp xỉ, phần trăm. Tuần ít mẫu thì điểm đó lung lay hơn.</summary>
        double? MoePercent);

    public sealed record PriceIndexForecast(
        string Method,
        double NextIndex,
        double ChangePercent,
        double BacktestMape,
        /// <summary>false = dữ liệu chưa đủ để dự báo đáng tin. Giao diện PHẢI nói rõ điều
        /// này thay vì hiện con số như một dự báo chắc chắn.</summary>
        bool Reliable,
        string Note);

    public sealed record PriceIndexDto(
        bool Available,
        string Scope,
        IReadOnlyList<PriceIndexPoint> Points,
        /// <summary>Chỉ số trung vị thô — chỉ để đối chiếu, không dùng làm chỉ số chính.</summary>
        IReadOnlyList<PriceIndexPoint> NaivePoints,
        double? ChangePoints,
        double? WeeklyVolatility,
        /// <summary>Khoảng cách trung bình giữa hedonic và trung vị thô. Chính là phần biến
        /// động do đổi cơ cấu tin đăng chứ không phải do giá thị trường.</summary>
        double? MixShiftMeanPoints,
        double? MixShiftMaxPoints,
        PriceIndexForecast? Forecast,
        string? BaseWeek,
        string? BuiltAt,
        string? Method,
        int? Rows,
        IReadOnlyList<string> Caveats);

    // ---- Hình dạng dây với dịch vụ Python ----

    internal sealed record MlIndexPoint(
        [property: JsonPropertyName("week_start")] string WeekStart,
        [property: JsonPropertyName("index")] double Index,
        [property: JsonPropertyName("n")] int N,
        [property: JsonPropertyName("moe_percent")] double? MoePercent);

    internal sealed record MlForecast(
        [property: JsonPropertyName("method")] string Method,
        [property: JsonPropertyName("next_index")] double NextIndex,
        [property: JsonPropertyName("change_percent")] double ChangePercent,
        [property: JsonPropertyName("backtest_mape")] double BacktestMape,
        [property: JsonPropertyName("reliable")] bool Reliable,
        [property: JsonPropertyName("note")] string Note);

    internal sealed record MlPriceIndex(
        [property: JsonPropertyName("available")] bool Available,
        [property: JsonPropertyName("scope")] string Scope,
        [property: JsonPropertyName("points")] List<MlIndexPoint>? Points,
        [property: JsonPropertyName("naive_points")] List<MlIndexPoint>? NaivePoints,
        [property: JsonPropertyName("change_points")] double? ChangePoints,
        [property: JsonPropertyName("weekly_volatility")] double? WeeklyVolatility,
        [property: JsonPropertyName("mix_shift_mean_points")] double? MixShiftMeanPoints,
        [property: JsonPropertyName("mix_shift_max_points")] double? MixShiftMaxPoints,
        [property: JsonPropertyName("forecast")] MlForecast? Forecast,
        [property: JsonPropertyName("base_week")] string? BaseWeek,
        [property: JsonPropertyName("built_at")] string? BuiltAt,
        [property: JsonPropertyName("method")] string? Method,
        [property: JsonPropertyName("rows")] int? Rows,
        [property: JsonPropertyName("caveats")] List<string>? Caveats);
}

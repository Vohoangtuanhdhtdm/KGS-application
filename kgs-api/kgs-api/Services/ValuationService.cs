using System.Net.Http.Json;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Utility;
using Microsoft.Extensions.Options;

namespace kgs_api.Services
{
    /// <summary>Cầu nối sang dịch vụ định giá Python (nhiệm vụ 2.5).
    ///
    /// Nguyên tắc bao trùm: dịch vụ định giá là thứ CÓ THÌ TỐT, không phải thứ bắt buộc.
    /// Nó chết, nó chậm, hoặc chưa ai huấn luyện mô hình — cả ba trường hợp đều không được
    /// phép làm hỏng việc đăng tin. Nên mọi lỗi ở đây đều quy về một câu trả lời: "chưa có
    /// giá tham khảo", và biểu mẫu đăng tin ẩn ô đó đi.
    /// </summary>
    public sealed class ValuationService : IValuationService
    {
        private readonly HttpClient _http;
        private readonly ILogger<ValuationService> _logger;

        public ValuationService(HttpClient http, ILogger<ValuationService> logger)
        {
            _http = http; _logger = logger;
        }

        // ---- Cầu dao ----
        // Dịch vụ định giá không trả lời (chưa chạy, sập, treo): mỗi lần gọi phải chờ hết thời
        // gian kết nối — trên Windows là ~2 giây cho mỗi địa chỉ thử — trong khi trang chi tiết
        // tin nào cũng gọi chỉ số giá. Gặp lỗi KẾT NỐI thì ghi nhớ 30 giây: các lần gọi trong
        // khoảng đó trả ngay "chưa có dữ liệu", không chờ nữa. Hết 30 giây thì thử lại một lần.
        // Tĩnh vì HttpClient có kiểu được tạo mới theo từng request.
        private static long _downUntilTicks;
        internal static readonly TimeSpan CoolDown = TimeSpan.FromSeconds(30);

        private static bool IsDown => DateTime.UtcNow.Ticks < Interlocked.Read(ref _downUntilTicks);

        /// <summary>Lỗi kết nối hoặc hết thời gian chờ (không phải do người gọi huỷ) → ngắt.
        /// Lỗi dữ liệu (JSON đổi hình dạng, 4xx/5xx) thì không: dịch vụ vẫn sống.</summary>
        private static void TripIfUnreachable(Exception ex, CancellationToken ct)
        {
            if (ex is HttpRequestException { StatusCode: null } || (ex is TaskCanceledException && !ct.IsCancellationRequested))
                Interlocked.Exchange(ref _downUntilTicks, DateTime.UtcNow.Add(CoolDown).Ticks);
        }

        /// <summary>Chỉ dùng trong kiểm thử — trạng thái cầu dao là tĩnh, dùng chung giữa các test.</summary>
        internal static void ResetCircuit() => Interlocked.Exchange(ref _downUntilTicks, 0);

        public async Task<ValuationResult?> EstimateAsync(ValuationRequest request, CancellationToken ct = default)
        {
            var payload = new MlValuationRequest(
                Area: request.Area,
                // Dịch vụ Python tự chuẩn hoá "TP. Hồ Chí Minh" → "ho chi minh" và
                // "Quận 8" → "8". Gửi nguyên văn sang, KHÔNG tự chuẩn hoá ở đây: hai bản
                // cài đặt của cùng một quy tắc chắc chắn sẽ trôi khỏi nhau, và khi đó mô
                // hình vẫn trả về số, chỉ là số của một quận khác.
                Province: request.City,
                District: request.District,
                Ward: request.Ward,
                PropertyType: request.PropertyType,
                HouseDirection: request.HouseDirection,
                BedroomCount: request.Bedrooms,
                BathroomCount: request.Bathrooms,
                FloorCount: request.Floors,
                FrontageWidth: request.Frontage);

            if (IsDown) return null;
            try
            {
                using var res = await _http.PostAsJsonAsync("/valuation", payload, ct);

                if (!res.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Dịch vụ định giá trả về {Status} cho {District}.",
                        (int)res.StatusCode, request.District);
                    return null;
                }

                var body = await res.Content.ReadFromJsonAsync<MlValuationResponse>(cancellationToken: ct);
                if (body is null) return null;

                return new ValuationResult(
                    body.Price, body.PriceLow, body.PriceHigh, body.PricePerM2,
                    body.Confidence, body.AreaMedianPricePerM2, body.AreaSampleSize,
                    body.Notes ?? new List<string>());
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                TripIfUnreachable(ex, ct);
                // Bắt rộng có chủ ý: dịch vụ chưa chạy, DNS hỏng, hết thời gian chờ, JSON
                // đổi hình dạng — với người đang đăng tin thì cả bốn đều là một chuyện, và
                // không chuyện nào đáng để chặn họ đăng tin.
                _logger.LogWarning(ex, "Không gọi được dịch vụ định giá.");
                return null;
            }
        }

        public async Task<ValuationModelInfo> GetModelInfoAsync(CancellationToken ct = default)
        {
            if (IsDown) return new ValuationModelInfo(false, null, null, null, null, null);
            try
            {
                var info = await _http.GetFromJsonAsync<MlModelInfo>("/model-info", ct);
                if (info is null || !info.Loaded) return new ValuationModelInfo(false, null, null, null, null, null);

                return new ValuationModelInfo(
                    true, info.TrainedAt, info.RowsFit, info.Mdape, info.Ppe10, info.Ppe20);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                TripIfUnreachable(ex, ct);
                _logger.LogWarning(ex, "Không lấy được thông tin mô hình định giá.");
                return new ValuationModelInfo(false, null, null, null, null, null);
            }
        }
        public async Task<PriceIndexDto> GetPriceIndexAsync(
            string? province, string? district, CancellationToken ct = default)
        {
            var query = new List<string>();
            if (!string.IsNullOrWhiteSpace(province)) query.Add($"province={Uri.EscapeDataString(province)}");
            if (!string.IsNullOrWhiteSpace(district)) query.Add($"district={Uri.EscapeDataString(district)}");
            var url = "/price-index" + (query.Count > 0 ? "?" + string.Join("&", query) : "");

            if (IsDown) return Unavailable();
            try
            {
                var raw = await _http.GetFromJsonAsync<MlPriceIndex>(url, ct);
                if (raw is null || !raw.Available) return Unavailable();

                return new PriceIndexDto(
                    Available: true,
                    Scope: raw.Scope,
                    Points: Map(raw.Points),
                    NaivePoints: Map(raw.NaivePoints),
                    ChangePoints: raw.ChangePoints,
                    WeeklyVolatility: raw.WeeklyVolatility,
                    MixShiftMeanPoints: raw.MixShiftMeanPoints,
                    MixShiftMaxPoints: raw.MixShiftMaxPoints,
                    Forecast: raw.Forecast is null
                        ? null
                        : new PriceIndexForecast(
                            raw.Forecast.Method, raw.Forecast.NextIndex,
                            raw.Forecast.ChangePercent, raw.Forecast.BacktestMape,
                            raw.Forecast.Reliable, raw.Forecast.Note),
                    BaseWeek: raw.BaseWeek,
                    BuiltAt: raw.BuiltAt,
                    Method: raw.Method,
                    Rows: raw.Rows,
                    Caveats: raw.Caveats ?? new List<string>());
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                TripIfUnreachable(ex, ct);
                // Cùng nguyên tắc với định giá: chỉ số giá là thứ có thì tốt. Dịch vụ chết
                // thì trang chi tiết vẫn hiện đủ nội dung, chỉ thiếu biểu đồ xu hướng.
                _logger.LogWarning(ex, "Không lấy được chỉ số giá.");
                return Unavailable();
            }
        }

        public async Task<IReadOnlyList<PriceIndexAreaDto>> GetPriceIndexAreasAsync(CancellationToken ct = default)
        {
            if (IsDown) return Array.Empty<PriceIndexAreaDto>();
            try
            {
                var raw = await _http.GetFromJsonAsync<List<MlPriceIndexArea>>("/price-index/areas", ct);
                return raw is null
                    ? Array.Empty<PriceIndexAreaDto>()
                    : raw.Select(a => new PriceIndexAreaDto(
                            a.Province, a.District, a.N, a.Weeks,
                            a.ChangePoints, a.WeeklyVolatility, a.LastIndex))
                        .ToList();
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                TripIfUnreachable(ex, ct);
                // Cùng nguyên tắc: danh sách rỗng thì trang tra cứu chỉ hiện chuỗi toàn quốc.
                _logger.LogWarning(ex, "Không lấy được danh sách khu vực có chỉ số giá.");
                return Array.Empty<PriceIndexAreaDto>();
            }
        }

        private static PriceIndexDto Unavailable() => new(
            false, "toàn quốc", Array.Empty<PriceIndexPoint>(), Array.Empty<PriceIndexPoint>(),
            null, null, null, null, null, null, null, null, null, Array.Empty<string>());

        private static List<PriceIndexPoint> Map(List<MlIndexPoint>? points)
            => points is null
                ? new List<PriceIndexPoint>()
                : points.Select(p => new PriceIndexPoint(p.WeekStart, p.Index, p.N, p.MoePercent)).ToList();
    }

    public sealed class ValuationSettings
    {
        public string BaseUrl { get; set; } = "http://127.0.0.1:8000";

        /// <summary>Thời gian chờ tối đa, giây.
        ///
        /// Ngắn có chủ ý: đây là ô gợi ý cạnh biểu mẫu đăng tin. Chờ 30 giây cho một con số
        /// tham khảo thì người dùng đã điền xong và bấm lưu từ lâu.</summary>
        public int TimeoutSeconds { get; set; } = 5;
    }
}

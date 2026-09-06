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
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Bắt rộng có chủ ý: dịch vụ chưa chạy, DNS hỏng, hết thời gian chờ, JSON
                // đổi hình dạng — với người đang đăng tin thì cả bốn đều là một chuyện, và
                // không chuyện nào đáng để chặn họ đăng tin.
                _logger.LogWarning(ex, "Không gọi được dịch vụ định giá.");
                return null;
            }
        }

        public async Task<ValuationModelInfo> GetModelInfoAsync(CancellationToken ct = default)
        {
            try
            {
                var info = await _http.GetFromJsonAsync<MlModelInfo>("/model-info", ct);
                if (info is null || !info.Loaded) return new ValuationModelInfo(false, null, null, null, null, null);

                return new ValuationModelInfo(
                    true, info.TrainedAt, info.RowsFit, info.Mdape, info.Ppe10, info.Ppe20);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Không lấy được thông tin mô hình định giá.");
                return new ValuationModelInfo(false, null, null, null, null, null);
            }
        }
    }

    public sealed class ValuationSettings
    {
        public string BaseUrl { get; set; } = "http://localhost:8000";

        /// <summary>Thời gian chờ tối đa, giây.
        ///
        /// Ngắn có chủ ý: đây là ô gợi ý cạnh biểu mẫu đăng tin. Chờ 30 giây cho một con số
        /// tham khảo thì người dùng đã điền xong và bấm lưu từ lâu.</summary>
        public int TimeoutSeconds { get; set; } = 5;
    }
}

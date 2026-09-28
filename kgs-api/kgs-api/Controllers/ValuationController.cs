using kgs_api.Dtos;
using kgs_api.Extensions;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace kgs_api.Controllers
{
    /// <summary>Giá tham khảo và chỉ số giá — dùng cả trong form đăng tin lẫn trang tra cứu công khai.</summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/valuation")]
    public sealed class ValuationController : ControllerBase
    {
        private readonly IValuationService _valuation;
        public ValuationController(IValuationService valuation) => _valuation = valuation;

        /// <summary>Ước tính giá bán. Trả 503 khi mô hình chưa sẵn sàng — client ẩn ô gợi ý
        /// đi chứ không hiện màn hình lỗi.
        ///
        /// Công khai kể từ khi có trang tra cứu /dinh-gia: người đang cân nhắc mua hay bán cần
        /// biết một căn đáng giá bao nhiêu TRƯỚC khi có tài khoản, và bắt đăng nhập ở đây là
        /// chặn đúng người có lý do mạnh nhất để quay lại nền tảng. Đổi lại, đây là endpoint
        /// công khai duy nhất tốn CPU thật cho mỗi lần gọi, nên nó có giới hạn tần suất riêng.</summary>
        [HttpPost("estimate")]
        [EnableRateLimiting(RateLimitingExtensions.Valuation)]
        public async Task<ActionResult<ValuationResult>> Estimate(
            [FromBody] ValuationRequest request, CancellationToken ct)
        {
            var result = await _valuation.EstimateAsync(request, ct);

            if (result is null)
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "Dịch vụ định giá hiện chưa sẵn sàng." });

            return Ok(result);
        }

        /// <summary>Độ đo của mô hình đang phục vụ. Giao diện dùng nó để nói thật với người
        /// dùng về sai số điển hình, thay vì để họ tự đoán con số đáng tin tới đâu.</summary>
        [HttpGet("model-info")]
        public async Task<ActionResult<ValuationModelInfo>> ModelInfo(CancellationToken ct)
            => Ok(await _valuation.GetModelInfoAsync(ct));

        /// <summary>Chỉ số giá theo tuần. Người đi tìm nhà cũng cần thấy thị trường đang đi
        /// lên hay đi xuống, không riêng người đăng tin.</summary>
        [HttpGet("price-index")]
        public async Task<ActionResult<PriceIndexDto>> PriceIndex(
            [FromQuery] string? province, [FromQuery] string? district, CancellationToken ct)
            => Ok(await _valuation.GetPriceIndexAsync(province, district, ct));

        /// <summary>Các quận có chuỗi chỉ số riêng — cho bộ chọn quận của trang tra cứu.</summary>
        [HttpGet("price-index/areas")]
        public async Task<ActionResult<IReadOnlyList<PriceIndexAreaDto>>> PriceIndexAreas(CancellationToken ct)
            => Ok(await _valuation.GetPriceIndexAreasAsync(ct));
    }
}

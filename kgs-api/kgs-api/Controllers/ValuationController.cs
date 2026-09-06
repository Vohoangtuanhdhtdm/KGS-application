using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Giá tham khảo cho người đăng tin (nhiem vu 2.5).</summary>
    [ApiController]
    [Authorize]
    [Route("api/valuation")]
    public sealed class ValuationController : ControllerBase
    {
        private readonly IValuationService _valuation;
        public ValuationController(IValuationService valuation) => _valuation = valuation;

        /// <summary>Ước tính giá bán. Trả 503 khi mô hình chưa sẵn sàng — client ẩn ô gợi ý
        /// đi chứ không hiện màn hình lỗi.</summary>
        [HttpPost("estimate")]
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
        [AllowAnonymous]
        public async Task<ActionResult<ValuationModelInfo>> ModelInfo(CancellationToken ct)
            => Ok(await _valuation.GetModelInfoAsync(ct));

        /// <summary>Chỉ số giá theo tuần. Công khai — người đi tìm nhà cũng cần thấy thị
        /// trường đang đi lên hay đi xuống, không riêng người đăng tin.</summary>
        [HttpGet("price-index")]
        [AllowAnonymous]
        public async Task<ActionResult<PriceIndexDto>> PriceIndex(
            [FromQuery] string? province, [FromQuery] string? district, CancellationToken ct)
            => Ok(await _valuation.GetPriceIndexAsync(province, district, ct));
    }
}

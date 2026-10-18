using kgs_api.Extensions;
using kgs_api.Services.Voice;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace kgs_api.Controllers
{
    /// <summary>Trợ lý giọng nói KiGi trên Trang chủ. Máy chủ chỉ cấp token tạm; âm thanh đi thẳng từ
    /// trình duyệt tới Gemini, KGS không nhận và không lưu.</summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/voice")]
    public sealed class VoiceController : ControllerBase
    {
        private readonly VoiceSessionService _voice;

        public VoiceController(VoiceSessionService voice) => _voice = voice;

        /// <summary>Có hiện nút micro hay không — không gọi Google, không tốn hạn mức.</summary>
        [HttpGet("status")]
        public ActionResult<object> Status() => Ok(new { enabled = _voice.Enabled });

        /// <summary>Token tạm cho một phiên. 503 khi chưa cấu hình khoá hoặc Gemini lỗi: giao diện
        /// ẩn micro chứ không hiện màn hình lỗi.</summary>
        [HttpPost("session")]
        [EnableRateLimiting(RateLimitingExtensions.Voice)]
        public async Task<ActionResult<VoiceSessionResult>> Session(CancellationToken ct)
        {
            var r = await _voice.CreateAsync(ct);
            if (r is null)
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "Trợ lý giọng nói hiện chưa sẵn sàng." });
            return Ok(r);
        }
    }
}

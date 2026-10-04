using kgs_api.Dtos;
using kgs_api.Extensions;
using kgs_api.Services.Assistant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace kgs_api.Controllers
{
    // ============================================================
    // TRỢ LÝ TÌM NHÀ — câu tiếng Việt → bộ lọc tìm kiếm (Groq)
    // ============================================================
    [ApiController]
    [Route("api/assistant")]
    public sealed class AssistantController : ControllerBase
    {
        private readonly SearchAssistantService _assistant;
        private readonly ListingWriterService _writer;
        private readonly IWebHostEnvironment _env;
        public AssistantController(SearchAssistantService assistant, ListingWriterService writer, IWebHostEnvironment env)
        {
            _assistant = assistant; _writer = writer; _env = env;
        }

        /// <summary>Viết tiêu đề + mô tả tin từ thông số người đăng đã nhập. Cần đăng nhập
        /// (chỉ người đăng tin dùng) và chung giới hạn tần suất với trợ lý tìm nhà.</summary>
        [HttpPost("write-listing")]
        [Authorize]
        [EnableRateLimiting(RateLimitingExtensions.Assistant)]
        public async Task<ActionResult<ListingWriterResult>> WriteListing(
            [FromBody] ListingWriterRequest request, CancellationToken ct)
        {
            try
            {
                return Ok(await _writer.WriteAsync(request, ct));
            }
            catch (GroqUnavailableException ex)
            {
                return Problem(ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Trợ lý viết tin tạm thời không dùng được");
            }
        }

        /// <summary>Dịch nhu cầu thành bộ lọc. Không cần đăng nhập — khách vãng lai cũng tìm
        /// nhà — nhưng có giới hạn tần suất vì mỗi lượt tốn hạn mức LLM.</summary>
        [AllowAnonymous]
        [HttpPost("search-intent")]
        [EnableRateLimiting(RateLimitingExtensions.Assistant)]
        public async Task<ActionResult<AssistantSearchResult>> SearchIntent(
            [FromBody] AssistantSearchRequest request, CancellationToken ct,
            [FromQuery] string? model = null)
        {
            try
            {
                // ?model= chỉ để bộ đánh giá so sánh các mô hình — tắt ngoài môi trường dev.
                var force = _env.IsDevelopment() && !string.IsNullOrWhiteSpace(model) ? model : null;
                return Ok(await _assistant.ParseAsync(request, ct, force));
            }
            catch (GroqUnavailableException ex)
            {
                // Trợ lý hỏng không được kéo theo cả trang tìm kiếm: giao diện nhận 503, báo
                // nhẹ nhàng và người dùng vẫn lọc bằng tay như thường.
                return Problem(ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Trợ lý tạm thời không dùng được");
            }
        }
    }
}

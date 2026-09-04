using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    /// <summary>Hàng đợi xử lý báo vi phạm.
    ///
    /// Nút "báo vi phạm" mà không có màn hình này thì chỉ là một cái nút cho có: người dùng
    /// bấm, tin vẫn nằm đó, và lần sau họ không bấm nữa. Hai nửa phải đi cùng nhau.</summary>
    [ApiController]
    [Authorize(Roles = "Admin")]
    [Route("api/admin/listing-reports")]
    public sealed class AdminListingReportsController : ControllerBase
    {
        private readonly IListingReportService _reports;
        public AdminListingReportsController(IListingReportService reports) => _reports = reports;

        /// <summary>Bỏ trống <paramref name="status"/> để xem tất cả.</summary>
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ListingReportDto>>> Get(
            [FromQuery] ListingReportStatus? status, CancellationToken ct)
            => Ok(await _reports.GetForModerationAsync(status, ct));

        [HttpPost("{id:guid}/resolve")]
        public async Task<IActionResult> Resolve(
            Guid id, [FromBody] ResolveListingReportRequest request, CancellationToken ct)
        {
            try
            {
                await _reports.ResolveAsync(id, request, ct);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                // Hai admin cùng mở hàng đợi và cùng bấm — người thứ hai cần biết vì sao
                // không có gì xảy ra, chứ không phải một màn hình lỗi 500.
                return Conflict(new { message = ex.Message });
            }
        }
    }
}

using kgs_api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Kiểm duyệt "Đăng nhu cầu" — xem AdminDemandService.</summary>
    [ApiController]
    [Authorize(Roles = "Admin")]
    [Route("api/admin/demands")]
    public sealed class AdminDemandsController : ControllerBase
    {
        private readonly AdminDemandService _service;
        public AdminDemandsController(AdminDemandService service) => _service = service;

        [HttpGet("pending")]
        public async Task<ActionResult<IReadOnlyList<AdminDemandDto>>> Pending(CancellationToken ct)
            => Ok(await _service.GetPendingAsync(ct));

        [HttpGet("pending/count")]
        public async Task<ActionResult<int>> PendingCount(CancellationToken ct)
            => Ok(await _service.CountPendingAsync(ct));

        [HttpPost("{id:guid}/approve")]
        public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
        {
            await _service.ApproveAsync(id, ct);
            return NoContent();
        }

        [HttpPost("{id:guid}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] RejectDemandRequest request, CancellationToken ct)
        {
            await _service.RejectAsync(id, request.Reason, ct);
            return NoContent();
        }

        [HttpPost("bulk")]
        public async Task<ActionResult<BulkDemandResultDto>> Bulk([FromBody] BulkDemandRequest request, CancellationToken ct)
            => Ok(await _service.BulkAsync(request, ct));
    }
}

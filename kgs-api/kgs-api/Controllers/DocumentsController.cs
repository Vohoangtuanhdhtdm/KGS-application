using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/documents")]
    public sealed class DocumentsController : ControllerBase
    {
        private readonly IAssetDocumentService _documents;
        public DocumentsController(IAssetDocumentService documents) => _documents = documents;

        /// <summary>A5 — Giấy tờ / hợp đồng dịch vụ sắp hết hạn trên toàn bộ danh mục tài sản.</summary>
        [HttpGet("expiring")]
        public async Task<ActionResult<IReadOnlyList<ExpiringDocumentDto>>> GetExpiring(
            [FromQuery] int withinDays, CancellationToken ct)
            => Ok(await _documents.GetExpiringAsync(withinDays <= 0 ? 30 : withinDays, ct));
    }
}

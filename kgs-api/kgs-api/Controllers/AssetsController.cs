using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/assets")]
    public sealed class AssetsController : ControllerBase
    {
        private readonly IAssetService _assets;
        private readonly IAssetMediaService _media;
        private readonly IAssetDocumentService _documents;
        private readonly IAssetUnitService _units;

        public AssetsController(IAssetService assets, IAssetMediaService media,
            IAssetDocumentService documents, IAssetUnitService units)
        {
            _assets = assets; _media = media; _documents = documents; _units = units;
        }

        // -------------------- A1. CRUD --------------------

        [HttpPost]
        public async Task<ActionResult<AssetDetailDto>> Create(
            [FromBody] AssetCreateRequest request, CancellationToken ct)
        {
            var result = await _assets.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { assetId = result.Id }, result);
        }

        [HttpGet("{assetId:guid}")]
        public async Task<ActionResult<AssetDetailDto>> GetById(Guid assetId, CancellationToken ct)
            => Ok(await _assets.GetByIdAsync(assetId, ct));

        [HttpPut("{assetId:guid}")]
        public async Task<ActionResult<AssetDetailDto>> Update(
            Guid assetId, [FromBody] AssetUpdateRequest request, CancellationToken ct)
            => Ok(await _assets.UpdateAsync(assetId, request, ct));

        [HttpDelete("{assetId:guid}")]
        public async Task<IActionResult> Delete(Guid assetId, CancellationToken ct)
        {
            await _assets.DeleteAsync(assetId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<AssetSummaryDto>>> Search(
            [FromQuery] AssetSearchQuery query, CancellationToken ct)
            => Ok(await _assets.SearchAsync(query, ct));

        // -------------------- A2. NEARBY (PostGIS) --------------------

        [HttpGet("map-pins")]
        public async Task<ActionResult<IReadOnlyList<AssetMapPinDto>>> GetMapPins(CancellationToken ct)
        {
            var result = await _assets.GetMapPinsAsync(ct);
            return Ok(result);
        }

        [HttpGet("nearby")]
        public async Task<ActionResult<IReadOnlyList<AssetNearbyDto>>> Nearby(
            [FromQuery] NearbyQuery query, CancellationToken ct)
            => Ok(await _assets.FindNearbyAsync(query, ct));

        // -------------------- A3. LINK PROPERTY --------------------

        [HttpPost("{assetId:guid}/link-property/{propertyId:int}")]
        public async Task<IActionResult> LinkProperty(Guid assetId, int propertyId, CancellationToken ct)
        {
            await _assets.LinkPropertyAsync(assetId, propertyId, ct);
            return NoContent();
        }

        [HttpDelete("{assetId:guid}/link-property")]
        public async Task<IActionResult> UnlinkProperty(Guid assetId, CancellationToken ct)
        {
            await _assets.UnlinkPropertyAsync(assetId, ct);
            return NoContent();
        }

        // -------------------- A4. MEDIA (ảnh theo thời gian) --------------------

        [HttpPost("{assetId:guid}/media")]
        [RequestSizeLimit(120_000_000)] // ~10MB x 10 files buffer an toàn
        public async Task<ActionResult<IReadOnlyList<AssetMediaDto>>> UploadMedia(
            Guid assetId, [FromForm] AssetMediaUploadRequest request, CancellationToken ct)
            => Ok(await _media.UploadAsync(assetId, request, ct));

        [HttpGet("{assetId:guid}/media")]
        public async Task<ActionResult<IReadOnlyList<AssetMediaDto>>> GetGallery(Guid assetId, CancellationToken ct)
            => Ok(await _media.GetGalleryAsync(assetId, ct));

        [HttpDelete("{assetId:guid}/media/{mediaId:guid}")]
        public async Task<IActionResult> DeleteMedia(Guid assetId, Guid mediaId, CancellationToken ct)
        {
            await _media.DeleteAsync(assetId, mediaId, ct);
            return NoContent();
        }

        [HttpPut("{assetId:guid}/thumbnail")]
        [RequestSizeLimit(15_000_000)]
        public async Task<IActionResult> SetThumbnail(
            Guid assetId, IFormFile file, CancellationToken ct)
        {
            await _media.SetThumbnailAsync(assetId, file, ct);
            return NoContent();
        }

        /// <summary>Đặt một ảnh trong gallery làm ảnh đại diện — không upload lại file.</summary>
        [HttpPut("{assetId:guid}/thumbnail/from-media/{mediaId:guid}")]
        public async Task<IActionResult> SetThumbnailFromMedia(Guid assetId, Guid mediaId, CancellationToken ct)
        {
            await _media.SetThumbnailFromMediaAsync(assetId, mediaId, ct);
            return NoContent();
        }

        // -------------------- A5. DOCUMENTS (giấy tờ) --------------------

        [HttpPost("{assetId:guid}/documents")]
        [RequestSizeLimit(30_000_000)]
        public async Task<ActionResult<AssetDocumentDto>> UploadDocument(
            Guid assetId, [FromForm] AssetDocumentUploadRequest request, CancellationToken ct)
            => Ok(await _documents.UploadAsync(assetId, request, ct));

        [HttpGet("{assetId:guid}/documents")]
        public async Task<ActionResult<IReadOnlyList<AssetDocumentDto>>> GetDocuments(
            Guid assetId, [FromQuery] DocumentType? type, CancellationToken ct)
            => Ok(await _documents.GetByAssetAsync(assetId, type, ct));

        [HttpDelete("{assetId:guid}/documents/{documentId:guid}")]
        public async Task<IActionResult> DeleteDocument(Guid assetId, Guid documentId, CancellationToken ct)
        {
            await _documents.DeleteAsync(assetId, documentId, ct);
            return NoContent();
        }

        // -------------------- A6. UNITS (tầng/phòng) --------------------

        [HttpPost("{assetId:guid}/units")]
        public async Task<ActionResult<AssetUnitDto>> CreateUnit(
            Guid assetId, [FromBody] AssetUnitRequest request, CancellationToken ct)
            => Ok(await _units.CreateAsync(assetId, request, ct));

        [HttpGet("{assetId:guid}/units")]
        public async Task<ActionResult<IReadOnlyList<AssetUnitDto>>> GetUnits(Guid assetId, CancellationToken ct)
            => Ok(await _units.GetByAssetAsync(assetId, ct));

        [HttpPut("{assetId:guid}/units/{unitId:guid}")]
        public async Task<ActionResult<AssetUnitDto>> UpdateUnit(
            Guid assetId, Guid unitId, [FromBody] AssetUnitRequest request, CancellationToken ct)
            => Ok(await _units.UpdateAsync(assetId, unitId, request, ct));

        [HttpDelete("{assetId:guid}/units/{unitId:guid}")]
        public async Task<IActionResult> DeleteUnit(Guid assetId, Guid unitId, CancellationToken ct)
        {
            await _units.DeleteAsync(assetId, unitId, ct);
            return NoContent();
        }
    }
}






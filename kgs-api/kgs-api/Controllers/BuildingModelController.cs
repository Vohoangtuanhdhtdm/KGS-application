using kgs_api.Dtos;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    /// <summary>Mô hình toà nhà 3D: chủ nhà dựng và công khai, người tìm nhà xem từ trang tin.</summary>
    [ApiController]
    public sealed class BuildingModelController : ControllerBase
    {
        private readonly BuildingModelService _models;
        public BuildingModelController(BuildingModelService models) => _models = models;

        [HttpGet("api/assets/{assetId:guid}/building-model")]
        [Authorize]
        public async Task<ActionResult<BuildingModelDto>> Get(Guid assetId, CancellationToken ct)
            => Ok(await _models.GetForOwnerAsync(assetId, ct));

        [HttpPut("api/assets/{assetId:guid}/building-model")]
        [Authorize]
        public async Task<ActionResult<BuildingModelDto>> Save(
            Guid assetId, [FromBody] SaveBuildingModelRequest request, CancellationToken ct)
            => Ok(await _models.SaveAsync(assetId, request, ct));

        /// <summary>Toà nhà có mô hình 3D trong khung nhìn của bản đồ tìm kiếm.</summary>
        [HttpGet("api/listings/buildings")]
        [AllowAnonymous]
        public async Task<ActionResult<List<MapBuildingDto>>> InView(
            [FromQuery] double west, [FromQuery] double south, [FromQuery] double east, [FromQuery] double north,
            [FromQuery] ListingType? type, CancellationToken ct)
            => Ok(await _models.GetInViewAsync(west, south, east, north, type, ct));

        /// <summary>404 khi toà nhà chưa có mô hình hoặc chủ nhà chưa công khai — trang tin khi
        /// đó dùng khối nhà 3D sẵn có của bản đồ.</summary>
        [HttpGet("api/listings/{slug}/building")]
        [AllowAnonymous]
        public async Task<ActionResult<BuildingModelDto>> GetPublic(string slug, CancellationToken ct)
        {
            var model = await _models.GetPublicBySlugAsync(slug, ct);
            return model is null ? NotFound() : Ok(model);
        }
    }
}

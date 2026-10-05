using kgs_api.Authorization;
using kgs_api.Services.OwnerBuildings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Toà nhà / khu trọ nhiều căn của chủ nhà — dựng mô hình 3D, đăng tin theo căn.</summary>
    [ApiController]
    [Authorize(Policy = AppPolicies.Owner)]
    [Route("api/buildings")]
    public sealed class OwnerBuildingsController : ControllerBase
    {
        private readonly OwnerBuildingService _svc;
        public OwnerBuildingsController(OwnerBuildingService svc) => _svc = svc;

        [HttpGet]
        public async Task<ActionResult<List<OwnerBuildingDto>>> List(CancellationToken ct)
            => Ok(await _svc.ListAsync(ct));

        [HttpPost]
        public async Task<ActionResult<OwnerBuildingDto>> Create([FromBody] CreateBuildingRequest request, CancellationToken ct)
            => Ok(await _svc.CreateAsync(request, ct));
    }
}

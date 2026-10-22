using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    /// <summary>Nhịp cầu — công khai, chỉ con số gộp (ngưỡng 3 người).</summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/demand-pulse")]
    public sealed class DemandPulseController : ControllerBase
    {
        private const int TopCount = 6;

        private readonly IDemandPulseService _service;
        public DemandPulseController(IDemandPulseService service) => _service = service;

        [HttpGet]
        public async Task<ActionResult<DemandPulseResponse>> Get(
            [FromQuery] ListingType? type, [FromQuery] string? city, [FromQuery] string? district,
            CancellationToken ct)
            => Ok(new DemandPulseResponse(await _service.GetAsync(type, city, district, ct)));

        [HttpGet("top")]
        public async Task<ActionResult<IReadOnlyList<DemandPulseDto>>> Top(
            [FromQuery] ListingType? type, CancellationToken ct)
            => Ok(await _service.GetTopAsync(type, TopCount, ct));
    }
}

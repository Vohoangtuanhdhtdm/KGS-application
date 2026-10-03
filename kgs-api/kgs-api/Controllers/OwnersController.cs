using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Hồ sơ công khai của người đăng tin.</summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/owners")]
    public sealed class OwnersController : ControllerBase
    {
        private readonly IListingService _listings;
        public OwnersController(IListingService listings) => _listings = listings;

        [HttpGet("{ownerId}")]
        public async Task<ActionResult<OwnerProfileDto>> Get(string ownerId, CancellationToken ct)
            => Ok(await _listings.GetOwnerProfileAsync(ownerId, ct));
    }
}

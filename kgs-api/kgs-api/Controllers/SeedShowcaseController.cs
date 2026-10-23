using kgs_api.Services;
using kgs_api.Services.Seeding;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Bộ dữ liệu trình diễn (xem ShowcaseSeeder) — chỉ có ở môi trường Development.
    ///
    /// POST api/dev/showcase              dựng lại từ đầu (xoá bộ cũ của chính nó trước)
    /// POST api/dev/showcase?replaceLegacy=true   xoá luôn 120 tin ngẫu nhiên của bộ demo cũ
    /// POST api/dev/showcase/clear        xoá bộ trình diễn, giữ tài khoản
    /// &amp;purgeUntagged=true                     xoá luôn dữ liệu tạo tay khi thử nghiệm (mọi tài khoản), giữ tài khoản</summary>
    [ApiController]
    [Authorize]
    [Route("api/dev/showcase")]
    public sealed class SeedShowcaseController : ControllerBase
    {
        private readonly ShowcaseSeeder _seeder;
        private readonly IWebHostEnvironment _env;
        private readonly IMemoryCache _cache;

        public SeedShowcaseController(ShowcaseSeeder seeder, IWebHostEnvironment env, IMemoryCache cache)
        {
            _seeder = seeder; _env = env; _cache = cache;
        }

        [HttpPost]
        public async Task<IActionResult> Seed(
            [FromQuery] bool replaceLegacy = false, [FromQuery] bool purgeUntagged = false, CancellationToken ct = default)
        {
            if (!_env.IsDevelopment()) return NotFound();
            var result = await _seeder.SeedAsync(replaceLegacy, ct, purgeUntagged);
            // Nhịp cầu đệm 10 phút: không xoá thì trang chủ vẫn hiện con số của bộ dữ liệu cũ.
            _cache.Remove(DemandPulseService.CacheKey);
            return Ok(result);
        }

        [HttpPost("clear")]
        public async Task<IActionResult> Clear([FromQuery] bool replaceLegacy = false, CancellationToken ct = default)
        {
            if (!_env.IsDevelopment()) return NotFound();
            var removed = await _seeder.ClearAsync(replaceLegacy, ct);
            _cache.Remove(DemandPulseService.CacheKey);
            return Ok(new { removedAssets = removed });
        }
    }
}

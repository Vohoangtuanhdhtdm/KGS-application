using kgs_api.Services.Seeding;
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

        public SeedShowcaseController(ShowcaseSeeder seeder, IWebHostEnvironment env)
        {
            _seeder = seeder; _env = env;
        }

        [HttpPost]
        public async Task<IActionResult> Seed(
            [FromQuery] bool replaceLegacy = false, [FromQuery] bool purgeUntagged = false, CancellationToken ct = default)
        {
            if (!_env.IsDevelopment()) return NotFound();
            return Ok(await _seeder.SeedAsync(replaceLegacy, ct, purgeUntagged));
        }

        [HttpPost("clear")]
        public async Task<IActionResult> Clear([FromQuery] bool replaceLegacy = false, CancellationToken ct = default)
        {
            if (!_env.IsDevelopment()) return NotFound();
            return Ok(new { removedAssets = await _seeder.ClearAsync(replaceLegacy, ct) });
        }
    }
}

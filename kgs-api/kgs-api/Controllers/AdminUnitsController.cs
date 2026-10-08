using kgs_api.Domain.Rules;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    /// <summary>Đơn vị hành chính sau sắp xếp 2025 — tra cứu công khai, dữ liệu tĩnh.</summary>
    [ApiController]
    [AllowAnonymous]
    [Route("api/admin-units")]
    public sealed class AdminUnitsController : ControllerBase
    {
        public sealed record ResolveResult(
            NewAddress? Address, IReadOnlyList<NewWardInfo> Candidates);

        /// <summary>Địa chỉ cũ (tỉnh, quận, phường) → địa chỉ mới. Ô nhập địa chỉ gọi để hiện
        /// "Địa chỉ mới: Phường X, Tỉnh Y" ngay khi chọn xong phường cũ. Phường cũ bị chia thì
        /// Candidates có nhiều phường mới.</summary>
        [HttpGet("resolve")]
        [ResponseCache(Duration = 86400)]
        public ActionResult<ResolveResult> Resolve(
            [FromQuery] string? city, [FromQuery] string? district, [FromQuery] string? ward)
        {
            var codes = AdministrativeUnits2025.CandidateWardCodes(city, district, ward);
            return Ok(new ResolveResult(
                AdministrativeUnits2025.Resolve(city, district, ward),
                codes.Select(AdministrativeUnits2025.Ward).OfType<NewWardInfo>().ToList()));
        }

        /// <summary>Đường viền một phường/xã mới (GeoJSON Feature, đã đơn giản hoá) — để bản đồ tìm
        /// nhà khoanh vùng khi lọc theo phường. 404 khi chưa có dữ liệu ranh giới cho phường đó.</summary>
        [HttpGet("wards/{code}/boundary")]
        [ResponseCache(Duration = 86400)]
        public IActionResult Boundary(string code)
        {
            var json = WardBoundaries.GeoJson(code);
            return json is null ? NotFound() : Content(json, "application/json");
        }

        [HttpGet("provinces")]
        [ResponseCache(Duration = 86400)]
        public ActionResult<IReadOnlyList<NewProvinceInfo>> Provinces()
            => Ok(AdministrativeUnits2025.Provinces);

        [HttpGet("provinces/{code}/wards")]
        [ResponseCache(Duration = 86400)]
        public ActionResult<IReadOnlyList<NewWardInfo>> Wards(string code)
            => AdministrativeUnits2025.Province(code) is null
                ? NotFound()
                : Ok(AdministrativeUnits2025.WardsOf(code).OrderBy(w => w.Name, StringComparer.Create(new System.Globalization.CultureInfo("vi-VN"), false)).ToList());
    }
}

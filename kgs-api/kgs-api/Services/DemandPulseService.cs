using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Đọc nhu cầu đang mở, đếm bằng <see cref="DemandPulse"/>, đệm 10 phút.
    ///
    /// Không so khớp với tin nào — chỉ đọc hai cột của bảng nhu cầu — nên đặt được trên trang
    /// chủ mà không làm chậm ai. Đệm cả bảng kết quả một lần thay vì theo từng khu vực: số nhu
    /// cầu nhỏ, và mọi lượt hỏi trong 10 phút dùng chung một lần tính.</summary>
    public sealed class DemandPulseService : IDemandPulseService
    {
        private const string CacheKey = "demand-pulse";
        private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

        private readonly IRepository<SavedSearch> _searches;
        private readonly IMemoryCache _cache;

        public DemandPulseService(IRepository<SavedSearch> searches, IMemoryCache cache)
        {
            _searches = searches; _cache = cache;
        }

        public async Task<DemandPulseDto?> GetAsync(
            ListingType? type, string? city, string? district, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(city)) return null;
            var c = AdministrativeNames.CanonicalCity(city);
            var d = string.IsNullOrWhiteSpace(district) ? null : AdministrativeNames.CanonicalDistrict(c, district);

            var groups = await GroupsAsync(ct);
            var g = groups.FirstOrDefault(x => x.Type == type && x.City == c && x.District == d);
            return g is null ? null : ToDto(g);
        }

        public async Task<IReadOnlyList<DemandPulseDto>> GetTopAsync(
            ListingType? type, int take, CancellationToken ct = default)
            => (await GroupsAsync(ct))
                .Where(g => g.District != null && g.Type == type)
                .OrderByDescending(g => g.People)
                .ThenBy(g => g.District)
                .Take(take)
                .Select(ToDto)
                .ToList();

        private async Task<IReadOnlyList<PulseGroup>> GroupsAsync(CancellationToken ct)
        {
            if (_cache.TryGetValue(CacheKey, out IReadOnlyList<PulseGroup>? cached) && cached is not null)
                return cached;

            var rows = await _searches.Query().AsNoTracking()
                .Where(DemandExpiry.OpenAt(DateTime.UtcNow))
                .Select(s => new { s.UserId, s.CriteriaJson })
                .ToListAsync(ct);

            var inputs = rows.Select(r =>
            {
                var q = SavedSearchService.Deserialize(r.CriteriaJson);
                var city = string.IsNullOrWhiteSpace(q.City) ? null : AdministrativeNames.CanonicalCity(q.City);
                var district = city is null || string.IsNullOrWhiteSpace(q.District)
                    ? null : AdministrativeNames.CanonicalDistrict(city, q.District);
                return new PulseInput(r.UserId, q.Type, city, district, q.PriceMax ?? q.TotalCostMax);
            });

            var groups = DemandPulse.Compute(inputs);
            _cache.Set(CacheKey, groups, CacheFor);
            return groups;
        }

        private static DemandPulseDto ToDto(PulseGroup g) => new(
            g.Type, g.City, g.District, g.People,
            g.Bands.Select(b => new DemandPulseBandDto(b.Label, b.Min, b.Max, b.People)).ToList());
    }
}

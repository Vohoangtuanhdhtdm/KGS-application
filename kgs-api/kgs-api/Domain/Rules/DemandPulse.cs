using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Một nhu cầu đang mở, rút gọn về đúng những gì Nhịp cầu cần.
    /// <paramref name="Budget"/> = trần giá, không có thì trần tổng chi phí.</summary>
    public sealed record PulseInput(string UserId, ListingType? Type, string? City, string? District, decimal? Budget);

    public sealed record PulseBand(string Label, decimal? Min, decimal? Max, int People);

    /// <summary><paramref name="Type"/> null = mọi loại tin; <paramref name="District"/> null = cả tỉnh/thành.</summary>
    public sealed record PulseGroup(ListingType? Type, string City, string? District, int People, IReadOnlyList<PulseBand> Bands);

    /// <summary>Nhịp cầu: "28 người đang tìm thuê ở Quận Bình Thạnh · 12 người 3–5 triệu".
    ///
    /// Đây là con số CÔNG KHAI nên phải giữ được ẩn danh: đếm số người khác nhau (một người lưu
    /// năm bộ lọc vẫn là một người), gộp theo nhóm thô nhất có ý nghĩa (loại tin, tỉnh, quận,
    /// khoảng giá cố định), và bỏ mọi nhóm dưới <see cref="MinPeople"/> — con số 1 hay 2 ở một
    /// quận nhỏ đủ để người quen đoán ra là ai.
    ///
    /// Không chạm CSDL: service đọc nhu cầu rồi gọi hàm này, nên quy tắc test được trọn vẹn.</summary>
    public static class DemandPulse
    {
        public const int MinPeople = 3;

        private static readonly (decimal Max, string Label)[] RentBands =
        {
            (3_000_000, "dưới 3 triệu"), (5_000_000, "3–5 triệu"), (10_000_000, "5–10 triệu"),
            (20_000_000, "10–20 triệu"), (decimal.MaxValue, "trên 20 triệu"),
        };

        private static readonly (decimal Max, string Label)[] SaleBands =
        {
            (2_000_000_000, "dưới 2 tỷ"), (5_000_000_000, "2–5 tỷ"), (10_000_000_000, "5–10 tỷ"),
            (20_000_000_000, "10–20 tỷ"), (decimal.MaxValue, "trên 20 tỷ"),
        };

        private static (decimal Max, string Label)[] BandsOf(ListingType type)
            => type == ListingType.Sale ? SaleBands : RentBands;

        /// <summary>Khoảng giá của một trần ngân sách. Trần là mức CAO NHẤT người tìm chịu trả,
        /// nên "dưới 5 triệu" (trần 5 tr) thuộc khoảng 3–5 triệu.</summary>
        public static int? BandIndex(ListingType type, decimal budget)
        {
            if (budget <= 0) return null;
            var bands = BandsOf(type);
            for (var i = 0; i < bands.Length; i++)
                if (budget <= bands[i].Max) return i;
            return null;
        }

        public static IReadOnlyList<PulseGroup> Compute(IEnumerable<PulseInput> demands)
        {
            // Chỉ nhóm THEO loại tin. Không có nhóm "mọi loại": lấy nó trừ nhóm "thuê" là lộ đúng số
            // người tìm mua ở đó — có thể là 1 hay 2, đúng thứ ngưỡng 3 người đang che.
            var people = new Dictionary<(ListingType?, string, string?), HashSet<string>>();
            var bandPeople = new Dictionary<(ListingType, string, string?, int), HashSet<string>>();

            void Add<TKey>(Dictionary<TKey, HashSet<string>> map, TKey key, string user) where TKey : notnull
            {
                if (!map.TryGetValue(key, out var set)) map[key] = set = new HashSet<string>();
                set.Add(user);
            }

            foreach (var d in demands)
            {
                if (string.IsNullOrWhiteSpace(d.City) || d.Type is not { } type) continue;
                var districts = string.IsNullOrWhiteSpace(d.District)
                    ? new string?[] { null }
                    : new string?[] { null, d.District };
                int? band = d.Budget is { } b ? BandIndex(type, b) : null;

                foreach (var district in districts)
                {
                    Add(people, ((ListingType?)type, d.City, district), d.UserId);
                    if (band is { } i) Add(bandPeople, (type, d.City, district, i), d.UserId);
                }
            }

            var result = new List<PulseGroup>();
            foreach (var ((type, city, district), users) in people)
            {
                if (users.Count < MinPeople) continue;
                var bands = new List<PulseBand>();
                if (type is { } t)
                {
                    var defs = BandsOf(t);
                    for (var i = 0; i < defs.Length; i++)
                    {
                        if (!bandPeople.TryGetValue((t, city, district, i), out var inBand) || inBand.Count < MinPeople)
                            continue;
                        bands.Add(new PulseBand(defs[i].Label,
                            i == 0 ? null : defs[i - 1].Max,
                            defs[i].Max == decimal.MaxValue ? null : defs[i].Max,
                            inBand.Count));
                    }
                }
                result.Add(new PulseGroup(type, city, district, users.Count, bands));
            }
            return result;
        }
    }
}

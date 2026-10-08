using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace kgs_api.Domain.Rules
{
    /// <summary>Địa chỉ theo đơn vị hành chính sau sắp xếp 2025 (hai cấp: Tỉnh → Phường/Xã).</summary>
    /// <param name="Ambiguous">Phường cũ bị chia cho nhiều phường mới — đã chọn một (xem Resolve),
    /// nên hiển thị kèm chữ "khoảng" hoặc để người dùng kiểm tra lại.</param>
    public sealed record NewAddress(
        string ProvinceCode, string Province, string WardCode, string Ward, bool Ambiguous);

    public sealed record NewProvinceInfo(string Code, string Name);
    public sealed record NewWardInfo(string Code, string Name, string ProvinceCode);

    /// <summary>Đơn vị hành chính sau sắp xếp 2025 và bảng chuyển từ địa chỉ cũ.
    ///
    /// Từ 01/07/2025 (Nghị quyết 202/2025/QH15) cả nước còn 34 tỉnh/thành, bỏ cấp quận/huyện,
    /// 10.600 phường/xã cũ gộp thành 3.321 phường/xã mới. Hệ thống KHÔNG bỏ địa chỉ cũ: mô hình định
    /// giá học trên 637 nghìn tin ghi theo quận cũ, chỉ số giá cũng tính theo quận cũ, và người mua
    /// bán vẫn quen gọi "Quận 7", "Gò Vấp". Địa chỉ mới được SUY RA từ địa chỉ cũ qua bảng chuyển
    /// đổi chính thức, lưu song song, dùng để hiển thị và tìm kiếm theo tên mới.
    ///
    /// Dữ liệu: Data/vn-admin-2025.json, sinh từ gói vietnam-address-database (MIT).</summary>
    public static class AdministrativeUnits2025
    {
        private sealed record Data(
            List<NewProvinceInfo> Provinces,
            List<NewWardInfo> Wards,
            Dictionary<string, Dictionary<string, Dictionary<string, List<string>>>> Map);

        private sealed record Index(
            Dictionary<string, NewProvinceInfo> ProvinceByCode,
            Dictionary<string, NewWardInfo> WardByCode,
            Dictionary<(string P, string D, string W), List<string>> Map);

        private static readonly Lazy<Data> Raw = new(Load);
        private static readonly Lazy<Index> Idx = new(BuildIndex);

        private static Data Load()
        {
            var asm = Assembly.GetExecutingAssembly();
            var res = asm.GetManifestResourceNames().First(n => n.EndsWith("vn-admin-2025.json", StringComparison.Ordinal));
            using var s = asm.GetManifestResourceStream(res)!;
            return JsonSerializer.Deserialize<Data>(s, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        }

        private static Index BuildIndex()
        {
            var d = Raw.Value;
            var map = new Dictionary<(string, string, string), List<string>>();
            foreach (var (p, districts) in d.Map)
                foreach (var (dist, wards) in districts)
                    foreach (var (w, codes) in wards)
                    {
                        var key = (AdministrativeNames.Key(p), AdministrativeNames.Key(dist), WardKey(w));
                        if (map.TryGetValue(key, out var existing))
                            existing.AddRange(codes.Where(c => !existing.Contains(c)));
                        else map[key] = codes.ToList();
                    }
            return new Index(
                d.Provinces.ToDictionary(p => p.Code),
                d.Wards.ToDictionary(w => w.Code),
                map);
        }

        public static IReadOnlyList<NewProvinceInfo> Provinces => Raw.Value.Provinces;

        public static IEnumerable<NewWardInfo> WardsOf(string provinceCode)
            => Raw.Value.Wards.Where(w => w.ProvinceCode == provinceCode);

        public static NewProvinceInfo? Province(string? code)
            => code is not null && Idx.Value.ProvinceByCode.TryGetValue(code, out var p) ? p : null;

        public static NewWardInfo? Ward(string? code)
            => code is not null && Idx.Value.WardByCode.TryGetValue(code, out var w) ? w : null;

        /// <summary>Địa chỉ cũ (tỉnh, quận, phường) → địa chỉ mới; null khi không tra được.
        ///
        /// Phường cũ bị chia cho nhiều phường mới (52 trên 10.678 trường hợp): chọn phường mới có
        /// <paramref name="preferWardCode"/> nếu nó nằm trong danh sách (người gọi biết chắc hơn, ví
        /// dụ tra ranh giới theo toạ độ); không thì chọn phường mới GIỮ MÃ của phường cũ (thường là
        /// phần lớn diện tích phường cũ), cuối cùng là phường đầu danh sách.</summary>
        public static NewAddress? Resolve(string? city, string? district, string? ward, string? preferWardCode = null)
        {
            if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(district) || string.IsNullOrWhiteSpace(ward))
                return null;
            var idx = Idx.Value;
            var codes = Lookup(city, district, ward);
            if (codes.Count == 0) return null;

            var code = codes.Count == 1 ? codes[0]
                : preferWardCode is not null && codes.Contains(preferWardCode) ? preferWardCode
                : codes[0];
            var w = idx.WardByCode[code];
            var p = idx.ProvinceByCode[w.ProvinceCode];
            return new NewAddress(p.Code, p.Name, w.Code, w.Name, codes.Count > 1 && code != preferWardCode);
        }

        /// <summary>Các phường mới có thể ứng với một địa chỉ cũ (một hoặc vài phường).</summary>
        public static IReadOnlyList<string> CandidateWardCodes(string? city, string? district, string? ward)
            => string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(district) || string.IsNullOrWhiteSpace(ward)
                ? Array.Empty<string>()
                : Lookup(city, district, ward);

        /// <summary>Đưa tên viết tắt ("TP.HCM", "Q. Gò Vấp") về tên chính thức của danh mục cũ
        /// trước khi tra — bảng chuyển đổi ghi tên đầy đủ.</summary>
        private static List<string> Lookup(string city, string district, string ward)
        {
            var c = AdministrativeNames.CanonicalCity(city) ?? city;
            // "Q. Gò Vấp", "H. Củ Chi": Key chỉ hiểu "Q." trước SỐ ("Q.3"), nên mở rộng ở đây.
            // Bắt buộc có dấu chấm hoặc khoảng trắng sau chữ cái đầu — "Quận", "Huyện" không bị đụng.
            district = Regex.Replace(district.Trim(), @"^[Qq](\.\s*|\s+)(?=\p{L})", "Quận ");
            district = Regex.Replace(district, @"^[Hh](\.\s*|\s+)(?=\p{L})", "Huyện ");
            var d = AdministrativeNames.CanonicalDistrict(c, district) ?? district;
            return Idx.Value.Map.TryGetValue(
                (AdministrativeNames.Key(c), AdministrativeNames.Key(d), WardKey(ward)), out var codes)
                ? codes
                : new List<string>();
        }

        /// <summary>Khoá so khớp tên phường/xã: như AdministrativeNames.Key, thêm bỏ tiền tố
        /// "Phường"/"Xã"/"Thị trấn" (cả "P."/"X."/"TT.") khi phần còn lại là chữ ("Phường Bến Nghé" = "Bến Nghé"), giữ khi
        /// là số ("Phường 5" ≠ "Xã 5"), và bỏ số 0 đứng đầu ("Phường 05" = "Phường 5").</summary>
        public static string WardKey(string s)
        {
            var k = AdministrativeNames.Key(s);
            k = Regex.Replace(k, @"\b0+(\d)", "$1");
            k = Regex.Replace(k, @"^p\s*(\d+)$", "phuong $1");   // "P.12", "P12"
            var m = Regex.Match(k, @"^(phuong|xa|thi tran|p|x|tt)\s+(.+)$");
            if (m.Success && !m.Groups[2].Value.All(c => char.IsDigit(c) || c == ' '))
                k = m.Groups[2].Value;
            return k;
        }
    }
}

using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace kgs_api.Domain.Rules
{
    /// <summary>Quy mọi cách viết tên tỉnh/thành và quận/huyện về TÊN CHÍNH THỨC.
    ///
    /// Bộ lọc khu vực so khớp chữ chính xác, nên cùng một nơi mà lưu hai cách viết thì lọc theo
    /// cách này sẽ bỏ sót tin của cách kia. Đó đúng là chuyện đã xảy ra: dữ liệu mẫu ghi "TP. Hồ
    /// Chí Minh", biểu mẫu đăng tin ghi "Thành phố Hồ Chí Minh" — chọn Bình Thạnh ra 1 tin thay vì 3.
    ///
    /// Dạng chuẩn là dạng của danh mục hành chính mà biểu mẫu nhập địa chỉ dùng (gói npm
    /// vietnam-provinces) — mọi tin mới đều đi qua biểu mẫu đó, nên đây là dạng ít phải sửa nhất.
    /// Danh mục được sinh từ chính gói đó vào Data/vn-admin-units.json.
    ///
    /// Tên không nhận ra được thì giữ nguyên (đã cắt khoảng trắng) — không đoán bừa thành một nơi khác.</summary>
    public static class AdministrativeNames
    {
        private sealed record Province(string Name, string[] Districts);

        private static readonly Lazy<List<Province>> Units = new(Load);

        private static List<Province> Load()
        {
            var asm = Assembly.GetExecutingAssembly();
            var res = asm.GetManifestResourceNames().First(n => n.EndsWith("vn-admin-units.json", StringComparison.Ordinal));
            using var s = asm.GetManifestResourceStream(res)!;
            return JsonSerializer.Deserialize<List<Province>>(s, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        }

        /// <summary>Cách gọi tắt phổ biến của các thành phố lớn.</summary>
        private static readonly Dictionary<string, string> CityAliases = new()
        {
            ["hcm"] = "ho chi minh", ["tphcm"] = "ho chi minh", ["sai gon"] = "ho chi minh",
            ["saigon"] = "ho chi minh", ["sg"] = "ho chi minh",
            ["hn"] = "ha noi", ["dn"] = "da nang",
        };

        public static string? CanonicalCity(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;
            var k = Key(raw);
            if (CityAliases.TryGetValue(k.Replace(" ", ""), out var alias) || CityAliases.TryGetValue(k, out alias)) k = alias;
            return Units.Value.FirstOrDefault(p => Key(p.Name) == k)?.Name ?? raw.Trim();
        }

        /// <summary>Quận/huyện được tra TRONG tỉnh đã biết — "Quận 1" có ở nhiều nơi. Chưa biết
        /// tỉnh thì chỉ nhận khi tên quận là duy nhất trên cả nước.</summary>
        public static string? CanonicalDistrict(string? canonicalCity, string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;
            var k = Key(raw);
            var province = Units.Value.FirstOrDefault(p => p.Name == canonicalCity);
            if (province is not null)
                return province.Districts.FirstOrDefault(d => Key(d) == k) ?? raw.Trim();

            var hits = Units.Value.SelectMany(p => p.Districts).Where(d => Key(d) == k).Distinct().ToList();
            return hits.Count == 1 ? hits[0] : raw.Trim();
        }

        private static readonly Regex Parens = new(@"\(.*?\)", RegexOptions.Compiled);

        // Tiền tố hành chính, dài trước ngắn sau. Chỉ bỏ khi phần còn lại KHÔNG phải số:
        // "Quận 3" phải giữ "quan 3", vì "3" trơn trọi thì trùng với "Phường 3", "Huyện 3"...
        private static readonly string[][] Prefixes =
        {
            new[] { "thanh", "pho" }, new[] { "thi", "xa" }, new[] { "thi", "tran" },
            new[] { "tp" }, new[] { "tx" }, new[] { "tinh" }, new[] { "quan" }, new[] { "huyen" },
        };

        /// <summary>Khoá so khớp: bỏ dấu, chữ thường, bỏ phần trong ngoặc ("(Q2 cũ)"), bỏ tiền tố
        /// hành chính; "Q.3", "Q3", "Quận 3" đều thành "quan 3".</summary>
        public static string Key(string s)
        {
            var u = SoftPreferences.Unaccent(Parens.Replace(s, " "));
            u = Regex.Replace(u, @"[^a-z0-9 ]", " ");
            u = Regex.Replace(u, @"\bq\s*(\d+)\b", "quan $1");
            var words = u.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            foreach (var p in Prefixes)
            {
                if (words.Count > p.Length && words.Take(p.Length).SequenceEqual(p))
                {
                    var rest = words.Skip(p.Length).ToList();
                    words = rest.All(w => w.All(char.IsDigit)) ? new List<string> { "quan" }.Concat(rest).ToList() : rest;
                    break;
                }
            }
            return string.Join(' ', words);
        }
    }
}

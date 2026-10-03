using System.Globalization;
using System.Text;

namespace kgs_api.Domain.Rules
{
    /// <summary>Bộ giá trị chuẩn cho hướng nhà, pháp lý và nội thất.
    ///
    /// Ba trường này lưu dạng chữ, và trước đây mỗi nơi ghi một kiểu: biểu mẫu dùng "Đầy đủ",
    /// dữ liệu mẫu ghi "Đầy đủ nội thất", người dùng gõ "full nội thất". Lưu trữ thì không sao,
    /// nhưng LỌC thì hỏng: chọn "Đầy đủ" sẽ bỏ sót mọi tin ghi "Đầy đủ nội thất" mà người tìm
    /// không hề biết. Nên mọi giá trị đều đi qua đây trước khi ghi xuống — và bộ lọc so khớp
    /// đúng trên cùng bộ giá trị này.
    ///
    /// Giá trị không nhận ra được thì GIỮ NGUYÊN (người dùng chọn "Khác" rồi tự gõ) — nó vẫn
    /// hiện trên trang tin, chỉ không lọt vào bộ lọc theo nhóm chuẩn. Phải khớp với
    /// HOUSE_DIRECTIONS / LEGAL_STATUS_OPTIONS / FURNITURE_STATE_OPTIONS ở frontend.</summary>
    public static class PropertyVocabulary
    {
        public static readonly string[] Directions =
            { "Đông", "Tây", "Nam", "Bắc", "Đông Bắc", "Đông Nam", "Tây Bắc", "Tây Nam" };

        public static readonly string[] LegalStatuses =
            { "Sổ hồng riêng", "Sổ hồng chung", "Sổ đỏ", "Đang chờ sổ", "Hợp đồng mua bán" };

        public static readonly string[] FurnitureStates = { "Đầy đủ", "Cơ bản", "Không nội thất" };

        public static string? NormalizeDirection(string? raw)
        {
            var k = Key(raw);
            if (k is null) return null;
            // "dong nam", "đông-nam", "DN", "hướng Đông Nam" → "Đông Nam"
            k = k.Replace("huong", "").Replace("-", " ").Replace("  ", " ").Trim();
            var abbrev = new Dictionary<string, string>
            {
                ["d"] = "Đông", ["t"] = "Tây", ["n"] = "Nam", ["b"] = "Bắc",
                ["db"] = "Đông Bắc", ["dn"] = "Đông Nam", ["tb"] = "Tây Bắc", ["tn"] = "Tây Nam",
            };
            if (abbrev.TryGetValue(k.Replace(" ", ""), out var a) && k.Length <= 2) return a;
            return Directions.FirstOrDefault(d => Key(d) == k) ?? raw!.Trim();
        }

        public static string? NormalizeLegal(string? raw)
        {
            var k = Key(raw);
            if (k is null) return null;
            if (k.Contains("cho so") || k.Contains("dang lam so")) return "Đang chờ sổ";
            if (k.Contains("hop dong mua ban") || k == "hdmb") return "Hợp đồng mua bán";
            if (k.Contains("so do")) return "Sổ đỏ";
            if (k.Contains("so hong") || k.Contains("so rieng") || k.Contains("so chung"))
                return k.Contains("chung") ? "Sổ hồng chung" : "Sổ hồng riêng";
            return raw!.Trim();
        }

        public static string? NormalizeFurniture(string? raw)
        {
            var k = Key(raw);
            if (k is null) return null;
            // So theo TỪ, không theo chuỗi con: "tho" (bàn giao thô) nằm trong "thoáng mát".
            var words = k.Split(' ');
            if (words.Contains("khong") || k.Contains("nha trong") || words.Contains("tho")) return "Không nội thất";
            if (k.Contains("day du") || k.Contains("full") || k.Contains("cao cap")) return "Đầy đủ";
            if (k.Contains("co ban")) return "Cơ bản";
            return raw!.Trim();
        }

        /// <summary>Chuẩn hoá danh sách giá trị bộ lọc gửi lên: bỏ trùng, bỏ giá trị lạ (không
        /// thuộc bộ chuẩn thì không thể khớp gì), sắp cố định để hai bộ lọc giống nhau có cùng JSON.</summary>
        public static List<string>? NormalizeFilter(IEnumerable<string>? input, Func<string?, string?> normalize, string[] allowed)
        {
            if (input is null) return null;
            var list = input.Select(normalize).Where(v => v is not null && allowed.Contains(v))
                .Select(v => v!).Distinct().OrderBy(v => Array.IndexOf(allowed, v)).ToList();
            return list.Count == 0 ? null : list;
        }

        /// <summary>Chữ thường, bỏ dấu, gộp khoảng trắng — để so khớp không phụ thuộc cách gõ.</summary>
        private static string? Key(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var d = s.Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (var c in d)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }
}

using System.Globalization;
using System.Text;

namespace kgs_api.Domain.Rules
{
    /// <summary>Mong muốn MỀM của người tìm nhà ("yên tĩnh", "có ban công", "gần chợ").
    ///
    /// Nguyên tắc tách cứng/mềm của tầng truy hồi: điều kiện cứng (giá, loại hình, nội quy) đi
    /// vào WHERE và loại tin không đạt; mong muốn mềm CHỈ dùng để xếp hạng — tin không nhắc tới
    /// "ban công" vẫn hiện, chỉ đứng sau. Một căn 9 triệu không bao giờ được lọt vào "dưới 8
    /// triệu" chỉ vì mô tả của nó hay.
    ///
    /// Xếp hạng bằng full-text search sẵn có của PostgreSQL (cột SearchVector, cấu hình
    /// 'simple' trên chữ đã bỏ dấu), không cần mô hình embedding chạy kèm.</summary>
    public static class SoftPreferences
    {
        public const int MaxPhrases = 8;
        private const int MaxPhraseLength = 40;

        /// <summary>"yên tĩnh; ban công" → ["yên tĩnh", "ban công"].</summary>
        public static List<string> Parse(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return new();
            return raw.Split(new[] { ';', ',', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => p.Length is > 1 and <= MaxPhraseLength)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(MaxPhrases)
                .ToList();
        }

        /// <summary>Dựng tsquery: từ trong một cụm nối bằng &lt;-&gt; (đứng liền nhau), các cụm
        /// nối bằng | (khớp cụm nào cũng được điểm). Chỉ giữ chữ và số đã bỏ dấu — mọi ký tự
        /// đặc biệt của cú pháp tsquery bị loại, nên chuỗi người dùng không thể làm hỏng câu truy vấn.</summary>
        public static string? ToTsQuery(IEnumerable<string> phrases)
        {
            var parts = phrases
                .Select(Words)
                .Where(w => w.Count > 0)
                .Select(w => w.Count == 1 ? w[0] : "(" + string.Join(" <-> ", w) + ")")
                .ToList();
            return parts.Count == 0 ? null : string.Join(" | ", parts);
        }

        /// <summary>Những cụm mong muốn xuất hiện trong tiêu đề/mô tả — để giải thích "vì sao hợp".</summary>
        public static List<string> Matched(IEnumerable<string> phrases, string title, string description)
        {
            var text = " " + string.Join(' ', Words(title + " " + description)) + " ";
            return phrases.Where(p =>
            {
                var w = Words(p);
                return w.Count > 0 && text.Contains(" " + string.Join(' ', w) + " ");
            }).ToList();
        }

        private static List<string> Words(string s)
            => Unaccent(s).Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => new string(w.Where(char.IsLetterOrDigit).ToArray()))
                .Where(w => w.Length > 0)
                .ToList();

        /// <summary>Chữ thường, bỏ dấu tiếng Việt (đ → d) — cùng cách cột SearchVector được dựng.</summary>
        public static string Unaccent(string s)
        {
            var d = s.ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (var c in d)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }
    }
}

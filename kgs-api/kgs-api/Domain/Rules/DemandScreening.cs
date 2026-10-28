using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Bộ lọc tự động khi một nhu cầu được mở cho chủ nhà.
    ///
    /// Lời nhắn của nhu cầu hiện cho mọi chủ nhà phù hợp — chỗ dễ bị lợi dụng nhất để chèn liên kết,
    /// số điện thoại, rao vặt. Người tìm thật không cần để lại liên hệ (danh tính chỉ lộ khi họ nhận
    /// lời), nên các dấu hiệu dưới đây là lý do để GIỮ LẠI cho quản trị xem, không phải để từ chối.
    /// Không dính dấu hiệu nào thì duyệt ngay — người dùng thật không phải chờ.</summary>
    public static class DemandScreening
    {
        public const string Link = "Lời nhắn có đường liên kết";
        public const string Phone = "Lời nhắn có số điện thoại";
        public const string Email = "Lời nhắn có địa chỉ email";
        public const string Channel = "Lời nhắn có kênh liên lạc riêng";
        public const string Ad = "Lời nhắn giống tin rao vặt";
        public const string Unverified = "Tài khoản chưa xác thực email";
        public const string Burst = "Đăng nhiều nhu cầu trong thời gian ngắn";

        /// <summary>Từ nhu cầu mở thứ 4 trong 24 giờ thì giữ lại.</summary>
        public const int BurstLimit = 3;

        private static readonly Regex LinkRe = new(
            @"(https?://|www\.|\b[\w-]+\.(com|vn|net|org|info|xyz|me|ly|io)\b)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EmailRe = new(@"[\w.+-]+@[\w-]+\.[\w.]+", RegexOptions.Compiled);
        // Chữ số liền nhau sau khi bỏ dấu cách, chấm, gạch, ngoặc: 0xxxxxxxx(x) hoặc 84xxxxxxxxx.
        // Số tiền ("5.000.000") không bắt đầu bằng 0 hay 84 nên không khớp.
        private static readonly Regex PhoneRe = new(@"(?<!\d)(0\d{8,10}|84\d{9,10})(?!\d)", RegexOptions.Compiled);
        private static readonly Regex PhoneJoin = new(@"(?<=\d)[\s.\-()]+(?=\d)", RegexOptions.Compiled);

        private static readonly string[] ChannelWords = { "zalo", "facebook", "fb.com", "telegram", "messenger" };
        private static readonly string[] AdWords = { "cho thue", "can ban", "moi gioi", "vay von", "tuyen dung", "khuyen mai" };

        public static IReadOnlyList<string> Screen(string name, string? note, bool emailConfirmed, int openedLast24h)
        {
            var text = $"{name}\n{note}";
            var plain = Plain(text);
            var reasons = new List<string>();
            // Bỏ email ra trước: "an@gmail.com" là email, không phải đường liên kết.
            if (LinkRe.IsMatch(EmailRe.Replace(text, " "))) reasons.Add(Link);
            if (PhoneRe.IsMatch(PhoneJoin.Replace(text.Replace("+", ""), ""))) reasons.Add(Phone);
            if (EmailRe.IsMatch(text)) reasons.Add(Email);
            if (ChannelWords.Any(plain.Contains)) reasons.Add(Channel);
            if (AdWords.Any(plain.Contains)) reasons.Add(Ad);
            if (!emailConfirmed) reasons.Add(Unverified);
            if (openedLast24h >= BurstLimit) reasons.Add(Burst);
            return reasons.Distinct().ToList();
        }

        /// <summary>Lời nhắn đổi nội dung (không tính khoảng trắng) thì phải kiểm tra lại.</summary>
        public static bool NeedsRescreen(string? oldNote, string? newNote) => Squash(oldNote) != Squash(newNote);

        public static (DemandReviewStatus Status, string? Reason) Decide(IReadOnlyList<string> reasons)
            => reasons.Count == 0 ? (DemandReviewStatus.Approved, null) : (DemandReviewStatus.Pending, string.Join("; ", reasons));

        private static string Squash(string? s) => Regex.Replace(s ?? "", @"\s+", " ").Trim();

        /// <summary>Bỏ dấu, đ→d, chữ thường — "ZALO", "Môi giới" đều so được.</summary>
        private static string Plain(string s)
        {
            var sb = new StringBuilder();
            foreach (var c in s.Normalize(NormalizationForm.FormD))
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant();
        }
    }
}

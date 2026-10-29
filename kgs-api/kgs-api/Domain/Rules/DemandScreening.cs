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
        public const string Resubmit = "Gửi lại sau khi bị từ chối";

        /// <summary>Từ nhu cầu mở thứ 4 trong 24 giờ thì giữ lại.</summary>
        public const int BurstLimit = 3;

        private static readonly Regex LinkRe = new(
            @"(https?://|www\.|\b[\w-]+\.(com|vn|net|org|info|xyz|me|ly|io)\b)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EmailRe = new(@"[\w.+-]+@[\w-]+\.[\w.]+", RegexOptions.Compiled);
        // Chữ số liền nhau sau khi bỏ dấu cách, chấm, gạch, phẩy, ngoặc (không nối qua xuống dòng):
        // di động 0[35789] + 8 số, bàn 02 + 9 số, hoặc 84 thay số 0. Số tiền ("5.000.000", "84 tỷ")
        // không có đầu số đó nên không khớp.
        private static readonly Regex PhoneRe = new(@"(?<!\d)(0[35789]\d{8}|02\d{9}|84[35789]\d{8})(?!\d)", RegexOptions.Compiled);
        private static readonly Regex PhoneJoin = new(@"(?<=\d)[ 	.\-()_,]+(?=\d)", RegexOptions.Compiled);
        // Ngày "05.11.2026" bỏ ra trước khi nối số, kẻo nối với số đứng sau thành dãy giống số điện thoại.
        private static readonly Regex DateRe = new(@"(?<!\d)\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?!\d)", RegexOptions.Compiled);
        // Chữ O đứng thay số 0 ở đầu dãy số: "O901234567".
        private static readonly Regex LetterO = new(@"(?<!\p{L})[oO](?=[ 	.\-()_,]*\d)", RegexOptions.Compiled);

        // So trên chuỗi đã bỏ hết dấu cách, chấm: "za lo", "z.a.l.o" vẫn là "zalo".
        private static readonly string[] ChannelWords = { "zalo", "facebook", "telegram", "messenger" };
        // Rao vặt so trên cả cụm từ. "cần bán" chỉ so khi còn dấu — bỏ dấu thì trùng "cần bạn (ở ghép)",
        // "căn bản". Không có "cho thuê": người tìm nhà vẫn gõ "tìm phòng cho thuê".
        private static readonly string[] AdWordsAccented = { "cần bán" };
        private static readonly string[] AdWordsPlain = { "moi gioi", "vay von", "tuyen dung", "khuyen mai" };

        public static IReadOnlyList<string> Screen(string name, string? note, bool emailConfirmed, int openedLast24h)
        {
            var text = $"{name}\n{note}";
            var plain = Plain(text);
            var reasons = new List<string>();
            // Bỏ email ra trước: "an@gmail.com" là email, không phải đường liên kết.
            if (LinkRe.IsMatch(EmailRe.Replace(text, " "))) reasons.Add(Link);
            if (PhoneRe.IsMatch(PhoneDigits(text))) reasons.Add(Phone);
            if (EmailRe.IsMatch(CompactEmail(text))) reasons.Add(Email);
            var compact = Regex.Replace(plain, @"[^\p{L}\d]", "");
            if (ChannelWords.Any(compact.Contains) || HasPhrase(plain, "fb")) reasons.Add(Channel);
            var lower = text.ToLowerInvariant();
            if (AdWordsAccented.Any(w => HasPhrase(lower, w)) || AdWordsPlain.Any(w => HasPhrase(plain, w)))
                reasons.Add(Ad);
            if (!emailConfirmed) reasons.Add(Unverified);
            if (openedLast24h >= BurstLimit) reasons.Add(Burst);
            return reasons.Distinct().ToList();
        }

        /// <summary>Lời nhắn đổi nội dung (không tính khoảng trắng) thì phải kiểm tra lại.</summary>
        public static bool NeedsRescreen(string? oldNote, string? newNote) => Squash(oldNote) != Squash(newNote);

        /// <summary>Nhu cầu từng bị quản trị từ chối thì gửi lại luôn phải qua người xem — nếu không,
        /// lý do giữ lần trước (đăng dày, chưa xác thực) hết hiệu lực là nó tự được duyệt với đúng nội
        /// dung đã bị từ chối.</summary>
        public static (DemandReviewStatus Status, string? Reason) Decide(
            IReadOnlyList<string> reasons, DemandReviewStatus previous = DemandReviewStatus.Approved)
        {
            var all = previous == DemandReviewStatus.Rejected ? reasons.Prepend(Resubmit).ToList() : reasons;
            return all.Count == 0 ? (DemandReviewStatus.Approved, null) : (DemandReviewStatus.Pending, string.Join("; ", all));
        }

        /// <summary>Lý do của quản trị được chèn vào câu "Lý do: …." — bỏ dấu câu cuối để không ra "..".</summary>
        public static string CleanReason(string reason) => reason.Trim().TrimEnd('.', '!', '?', ',', ';', ' ');

        private static string PhoneDigits(string text)
            => PhoneJoin.Replace(LetterO.Replace(DateRe.Replace(text.Replace("+", ""), " "), "0"), "");

        /// <summary>"an @ gmail . com" → "an@gmail.com".</summary>
        private static string CompactEmail(string text)
            => Regex.Replace(Regex.Replace(text, @"\s*@\s*", "@"), @"(?<=@[\w.-]*)\s*\.\s*(?=\w)", ".");

        private static bool HasPhrase(string text, string phrase)
            => Regex.IsMatch(text, $@"(?<![\p{{L}}\d]){Regex.Escape(phrase)}(?![\p{{L}}\d])");

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

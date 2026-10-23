using System.Text;

namespace kgs_api.Services.Email
{
    /// <summary>Biểu tượng nét mảnh của một dòng chi tiết — ảnh PNG nhúng vào thư (cid:icon-…),
    /// sinh bằng kgs-api/tools/email_icons.py. Không dùng emoji: mỗi máy vẽ emoji một kiểu.</summary>
    public enum EmailIcon { None, User, Phone, Calendar, Message }

    /// <summary>Một dòng thông tin trong khung chi tiết của email ("Số điện thoại: 0901…").
    /// <paramref name="Href"/> = liên kết khi bấm vào giá trị (tel:, mailto:, https:).</summary>
    public sealed record EmailDetail(EmailIcon Icon, string Label, string Value, string? Href = null);

    /// <summary>Nội dung một email, chưa có định dạng. <paramref name="Preheader"/> là câu hiện cạnh
    /// tiêu đề trong hộp thư (Gmail, Outlook) trước khi mở thư.</summary>
    public sealed record EmailContent(
        string Title,
        string Preheader,
        string? Eyebrow,
        IReadOnlyList<string> Paragraphs,
        IReadOnlyList<EmailDetail> Details,
        string? CtaLabel,
        string? CtaUrl,
        string? Tip = null);

    /// <summary>Khung chung cho MỌI email của KGS: KiGi động ở đầu thư, nhãn loại thư, tiêu đề,
    /// đoạn văn, khung chi tiết, nút bấm, mẹo và chân trang.
    ///
    /// Viết bằng bảng lồng nhau và style nội tuyến vì đó là thứ duy nhất Gmail, Outlook và ứng dụng
    /// thư trên điện thoại cùng hiểu — thẻ &lt;style&gt;, flexbox, SVG hay CSS animation đều bị bỏ.
    /// KiGi vì thế là ảnh GIF nhúng thẳng vào thư (cid:kigi, xem SmtpEmailSender), không phụ thuộc
    /// máy chủ ảnh công khai. Mọi chữ đều được mã hoá HTML: tên tin, lời nhắn là do người dùng gõ.</summary>
    public static class EmailLayout
    {
        public const string KiGiContentId = "kigi";
        private const string TipIconId = "icon-tip";

        private static string? IconId(EmailIcon icon) => icon switch
        {
            EmailIcon.User => "icon-user",
            EmailIcon.Phone => "icon-phone",
            EmailIcon.Calendar => "icon-calendar",
            EmailIcon.Message => "icon-message",
            _ => null,
        };

        private static string Img(string cid, int size) =>
            $@"<img src=""cid:{cid}"" width=""{size}"" height=""{size}"" alt="""" style=""display:inline-block;border:0;width:{size}px;height:{size}px;vertical-align:-4px;"">";

        /// <summary>Các ảnh nhúng mà thư tham chiếu (cid:…) — bộ gửi đính kèm đúng những ảnh này.</summary>
        public static IReadOnlyList<string> ContentIds(string html)
            => System.Text.RegularExpressions.Regex.Matches(html, @"cid:([a-z0-9-]+)")
                .Select(m => m.Groups[1].Value)
                .Distinct()
                .ToList();

        private const string Primary = "#1E2761";
        private const string Font = "'Be Vietnam Pro','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

        /// <summary>Chỉ mã hoá năm ký tự có nghĩa trong HTML. WebUtility.HtmlEncode còn biến "ê", "à"…
        /// thành mã số (&amp;#234;) — vẫn đúng nhưng thư tiếng Việt phình gấp mấy lần.</summary>
        private static string E(string s) => s
            .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
            .Replace("\"", "&quot;").Replace("'", "&#39;");

        /// <summary>Đoạn văn tách theo dòng trống — nơi gọi viết "\n\n" để xuống đoạn.</summary>
        public static IReadOnlyList<string> SplitParagraphs(string body)
            => body.Replace("\r\n", "\n")
                .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(p => p.Length > 0)
                .ToList();

        /// <summary>Nhãn loại thư và mẹo ngắn, suy ra từ trang mà nút trong thư trỏ tới.</summary>
        public static (string Eyebrow, string? Tip) KindFor(string? linkPath)
        {
            var path = (linkPath ?? "").Split('?')[0];
            return path switch
            {
                "/yeu-cau" => ("Yêu cầu xem nhà",
                    "Liên hệ trong vòng một giờ giúp bạn giữ khách tốt hơn nhiều."),
                "/nhu-cau" => ("Nhu cầu & lời mời",
                    "Chủ nhà chỉ thấy tên và số điện thoại của bạn khi bạn nhận lời mời."),
                "/tin-cua-toi" => ("Tin đăng của bạn", null),
                "/tin-dang" => ("Tin mới cho bạn", null),
                _ => ("Thông báo từ KGS", null),
            };
        }

        public static (string Html, string Text) Render(EmailContent c) => (Html(c), Text(c));

        private static string Html(EmailContent c)
        {
            var sb = new StringBuilder();
            sb.Append($@"<!doctype html>
<html lang=""vi""><head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1"">
<title>{E(c.Title)}</title></head>
<body style=""margin:0;padding:0;background:#eef0f6;"">
<div style=""display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;"">{E(c.Preheader)}</div>
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#eef0f6;"">
<tr><td align=""center"" style=""padding:28px 12px;"">
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;font-family:{Font};"">
<tr><td style=""padding:0 4px 14px;"">
  <table role=""presentation"" cellpadding=""0"" cellspacing=""0""><tr>
    <td style=""background:{Primary};border-radius:9px;width:32px;height:32px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:700;font-size:14px;"">K</td>
    <td style=""padding-left:10px;font-size:17px;font-weight:700;color:{Primary};"">KGS</td>
    <td style=""padding-left:10px;font-size:12px;color:#6b7280;"">Tìm nhà và kết nối bất động sản</td>
  </tr></table>
</td></tr>
<tr><td style=""background:#ffffff;border-radius:16px;"">
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"">
<tr><td style=""height:6px;background:{Primary};border-radius:16px 16px 0 0;font-size:0;line-height:6px;"">&nbsp;</td></tr>
<tr><td style=""padding:26px 24px 4px;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0""><tr>
    <td width=""72"" valign=""top"" style=""padding-right:14px;"">
      <img src=""cid:{KiGiContentId}"" width=""72"" height=""72"" alt=""KiGi"" style=""display:block;border:0;width:72px;height:72px;"">
    </td>
    <td valign=""middle"">");
            if (!string.IsNullOrWhiteSpace(c.Eyebrow))
                sb.Append($@"
      <span style=""display:inline-block;background:#eef0fb;color:{Primary};font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;"">{E(c.Eyebrow)}</span>");
            sb.Append($@"
      <h1 style=""margin:10px 0 0;font-size:21px;line-height:1.35;color:#111827;font-weight:700;"">{E(c.Title)}</h1>
    </td>
  </tr></table>
</td></tr>");

            foreach (var p in c.Paragraphs)
                sb.Append($@"
<tr><td style=""padding:14px 24px 0;font-size:15px;line-height:1.65;color:#374151;"">{E(p)}</td></tr>");

            if (c.Details.Count > 0)
            {
                sb.Append(@"
<tr><td style=""padding:18px 24px 0;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f8f9fc;border:1px solid #e5e7f0;border-radius:12px;"">");
                for (var i = 0; i < c.Details.Count; i++)
                {
                    var d = c.Details[i];
                    var top = i == 0 ? 14 : 6;
                    var bottom = i == c.Details.Count - 1 ? 14 : 6;
                    var value = d.Href is null
                        ? E(d.Value)
                        : $@"<a href=""{E(d.Href)}"" style=""color:{Primary};font-weight:600;text-decoration:none;"">{E(d.Value)}</a>";
                    sb.Append($@"
    <tr>
      <td width=""38%"" valign=""top"" style=""padding:{top}px 8px {bottom}px 16px;font-size:13px;color:#6b7280;"">{(IconId(d.Icon) is { } icon ? Img(icon, 18) + "&nbsp;&nbsp;" : "")}{E(d.Label)}</td>
      <td valign=""top"" style=""padding:{top}px 16px {bottom}px 8px;font-size:14px;line-height:1.5;color:#111827;font-weight:500;"">{value}</td>
    </tr>");
                }
                sb.Append(@"
  </table>
</td></tr>");
            }

            if (!string.IsNullOrWhiteSpace(c.CtaUrl) && !string.IsNullOrWhiteSpace(c.CtaLabel))
                sb.Append($@"
<tr><td style=""padding:24px 24px 0;"">
  <table role=""presentation"" cellpadding=""0"" cellspacing=""0""><tr>
    <td style=""background:{Primary};border-radius:10px;"">
      <a href=""{E(c.CtaUrl)}"" style=""display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;"">{E(c.CtaLabel)}&nbsp;&nbsp;&rarr;</a>
    </td>
  </tr></table>
</td></tr>");

            if (!string.IsNullOrWhiteSpace(c.Tip))
                sb.Append($@"
<tr><td style=""padding:18px 24px 0;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0""><tr>
    <td style=""border-left:3px solid #f5b544;background:#fffaf0;border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;line-height:1.55;color:#5b4a2a;"">{Img(TipIconId, 18)}&nbsp; <b>KiGi mách bạn:</b> {E(c.Tip)}</td>
  </tr></table>
</td></tr>");

            sb.Append(@"
<tr><td style=""padding:26px 24px 0;font-size:0;line-height:0;"">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td style=""padding:20px 8px 0;font-size:12px;line-height:1.65;color:#8b90a0;text-align:center;"">");
            if (!string.IsNullOrWhiteSpace(c.CtaUrl))
                sb.Append($@"Nút không bấm được? Mở liên kết: <a href=""{E(c.CtaUrl)}"" style=""color:#6b7280;word-break:break-all;"">{E(c.CtaUrl)}</a><br>");
            sb.Append(@"Bạn nhận email này vì có tài khoản trên KGS.<br>
© KGS — nền tảng tìm kiếm và kết nối bất động sản
</td></tr>
</table>
</td></tr>
</table>
</body></html>");
            return sb.ToString();
        }

        /// <summary>Bản chữ thuần gửi kèm (multipart/alternative): trình đọc thư không hiện HTML vẫn
        /// đủ thông tin, và bộ lọc thư rác đánh giá thư có cả hai phần tốt hơn.</summary>
        private static string Text(EmailContent c)
        {
            var sb = new StringBuilder();
            sb.AppendLine(c.Title).AppendLine();
            foreach (var p in c.Paragraphs) sb.AppendLine(p).AppendLine();
            foreach (var d in c.Details) sb.AppendLine($"{d.Label}: {d.Value}");
            if (c.Details.Count > 0) sb.AppendLine();
            if (!string.IsNullOrWhiteSpace(c.CtaUrl) && !string.IsNullOrWhiteSpace(c.CtaLabel))
                sb.AppendLine($"{c.CtaLabel}: {c.CtaUrl}").AppendLine();
            if (!string.IsNullOrWhiteSpace(c.Tip)) sb.AppendLine($"KiGi mách bạn: {c.Tip}").AppendLine();
            sb.Append("— KGS, nền tảng tìm kiếm và kết nối bất động sản");
            return sb.ToString();
        }
    }
}

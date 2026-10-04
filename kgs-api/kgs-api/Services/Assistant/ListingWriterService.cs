using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using kgs_api.Services;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Assistant
{
    /// <summary>Thông số người đăng đã nhập — nguồn DUY NHẤT để viết tiêu đề và mô tả.</summary>
    public sealed record ListingWriterRequest(
        ListingType Type,
        AssetDomainType PropertyType,
        [MaxLength(100)] string? City,
        [MaxLength(100)] string? District,
        [MaxLength(100)] string? Ward,
        [MaxLength(200)] string? AddressDetail,
        double? Area,
        int? Bedrooms,
        int? Bathrooms,
        int? Floors,
        double? Frontage,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState,
        decimal? Price,
        List<string>? Amenities,
        /// <summary>Điểm nổi bật người đăng chọn hoặc gõ ("yên tĩnh", "gần chợ").</summary>
        List<string>? Highlights,
        /// <summary>Ghi chú tự do của người đăng — sẽ được viết lại cho gọn, không thêm ý.</summary>
        [MaxLength(400)] string? Notes);

    public sealed record ListingWriterResult(string Title, string Description, string Model, long LatencyMs);

    /// <summary>Viết tiêu đề + mô tả tin từ thông số (Groq).
    ///
    /// Ràng buộc quan trọng nhất: KHÔNG BỊA. Mô tả tin là lời cam kết với người tìm nhà; một
    /// câu "gần trường quốc tế" hay "view sông" mà người đăng không hề nói là thông tin sai mà
    /// chủ tin sẽ phải chịu khi bị báo vi phạm. Vì thế mô hình chỉ được viết lại những gì có
    /// trong dữ liệu gửi lên, và đầu ra còn qua một lượt dọn (Clean) phía máy chủ.</summary>
    public sealed class ListingWriterService
    {
        private readonly GroqChatClient _groq;
        public ListingWriterService(GroqChatClient groq) => _groq = groq;

        private const string System = """
            You write Vietnamese real-estate listings for KGS (Vietnam). Output JSON {title, description}.
            HARD RULES:
            - Use ONLY facts in the input. Never invent amenities, distances, landmarks, views, prices, deposits, contacts or legal claims.
            - Vietnamese with full diacritics. No emoji, no markdown, no ALL CAPS, no hype words (siêu, cực, rẻ nhất, hot).
            - title: 45-90 characters; include property type, area (m²) if given, the strongest highlight if any, and district. No price, no phone.
            - description: 3 short paragraphs separated by a blank line, 60-130 words total:
              1) what it is (type, area, rooms, floors, frontage, direction, furniture; legal status ONLY if a "pháp lý" line is given);
              2) highlights + amenities in natural sentences (only listed ones);
              3) location (ward, district, city, street if given) and a neutral invitation to contact/view.
            - Rewrite the owner's notes faithfully; drop anything that is not about the property.
            - If a fact is missing, simply do not mention it.
            """;

        private static readonly JsonObject Schema = new()
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["properties"] = new JsonObject
            {
                ["title"] = new JsonObject { ["type"] = "string" },
                ["description"] = new JsonObject { ["type"] = "string" },
            },
            ["required"] = new JsonArray("title", "description"),
        };

        public async Task<ListingWriterResult> WriteAsync(ListingWriterRequest r, CancellationToken ct)
        {
            var completion = await _groq.CompleteJsonAsync(System, Facts(r), "listing_text", Schema, ct);
            var o = JsonNode.Parse(completion.Json)?.AsObject() ?? new JsonObject();
            var title = Clean(o["title"]?.GetValue<string>() ?? "", singleLine: true);
            var description = Clean(o["description"]?.GetValue<string>() ?? "", singleLine: false);
            if (title.Length < 10 || description.Length < 30)
                throw new GroqUnavailableException("Trợ lý chưa viết được nội dung phù hợp, thử lại sau.");
            if (title.Length > 120) title = title[..117].TrimEnd() + "...";
            return new ListingWriterResult(title, description, completion.Model, completion.LatencyMs);
        }

        /// <summary>Dữ liệu gửi mô hình: một danh sách "nhãn: giá trị", chỉ những gì có thật.</summary>
        public static string Facts(ListingWriterRequest r)
        {
            var sb = new StringBuilder();
            void Add(string k, object? v)
            {
                if (v is null) return;
                var s = Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim();
                if (!string.IsNullOrEmpty(s)) sb.Append(k).Append(": ").AppendLine(s);
            }
            Add("loại tin", r.Type == ListingType.Sale ? "bán" : "cho thuê");
            Add("loại hình", ListingService.AssetTypeLabel(r.PropertyType));
            Add("diện tích m²", r.Area);
            Add("phòng ngủ", r.Bedrooms);
            Add("phòng tắm", r.Bathrooms);
            Add("số tầng", r.Floors);
            Add("mặt tiền m", r.Frontage);
            Add("hướng", r.HouseDirection);
            Add("pháp lý", r.Type == ListingType.Sale ? r.LegalStatus : null);
            Add("nội thất", r.FurnitureState);
            Add("tiện nghi", r.Amenities is { Count: > 0 } ? string.Join(", ", r.Amenities.Take(15)) : null);
            Add("điểm nổi bật", r.Highlights is { Count: > 0 } ? string.Join(", ", r.Highlights.Take(8).Select(h => h.Trim()).Where(h => h.Length is > 0 and <= 60)) : null);
            Add("đường / số nhà", r.AddressDetail);
            Add("phường/xã", r.Ward);
            Add("quận/huyện", r.District);
            Add("tỉnh/thành", r.City);
            Add("ghi chú của chủ", r.Notes);
            return sb.ToString();
        }

        /// <summary>Dọn đầu ra: bỏ ký hiệu markdown và emoji, gom khoảng trắng, giữ tối đa một
        /// dòng trống giữa các đoạn.</summary>
        public static string Clean(string s, bool singleLine)
        {
            s = Regex.Replace(s, @"[*_#`>]+", "");
            s = Regex.Replace(s, @"\p{Cs}|\p{So}", "");   // emoji, ký hiệu hình
            s = s.Replace("\r", "").Replace(' ', ' ').Replace(' ', ' ');
            if (singleLine) return Regex.Replace(s, @"\s+", " ").Trim().Trim('"', '“', '”');
            s = Regex.Replace(s, @"[ \t]+", " ");
            s = Regex.Replace(s, @" *\n *", "\n");
            s = Regex.Replace(s, @"\n{3,}", "\n\n");
            return s.Trim();
        }
    }
}

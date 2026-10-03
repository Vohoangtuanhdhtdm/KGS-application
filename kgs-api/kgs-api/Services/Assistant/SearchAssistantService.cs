using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Assistant
{
    /// <summary>Trợ lý tìm nhà: dịch MỘT câu tiếng Việt thành bộ lọc tìm kiếm.
    ///
    /// LLM chỉ làm việc dịch. Nó không tự chọn nhà, không xếp hạng, không viết lời khen tin —
    /// mọi kết quả vẫn do bộ lọc dùng chung (ListingSearchFilter) và full-text search trả về.
    /// Nhờ vậy câu trả lời kiểm chứng được: người dùng thấy rõ trợ lý đã hiểu thành những điều
    /// kiện nào, gỡ được từng điều kiện, và kết quả không bao giờ vi phạm điều kiện cứng.
    ///
    /// Mọi thứ LLM trả về đều được kiểm tra lại ở đây: quận phải có trong danh sách thật, giá
    /// phải dương, hướng/pháp lý phải thuộc bộ chuẩn... Cái gì không hợp lệ thì bỏ và báo lại
    /// trong Unrecognized, thay vì âm thầm lọc theo một điều kiện bịa ra.</summary>
    public sealed class SearchAssistantService
    {
        private readonly GroqChatClient _groq;
        private readonly IRepository<Listing> _listings;
        private readonly ILogger<SearchAssistantService> _logger;

        public SearchAssistantService(
            GroqChatClient groq, IRepository<Listing> listings, ILogger<SearchAssistantService> logger)
        {
            _groq = groq; _listings = listings; _logger = logger;
        }

        public async Task<AssistantSearchResult> ParseAsync(
            AssistantSearchRequest req, CancellationToken ct, string? forceModel = null)
        {
            var areas = await _listings.Query().AsNoTracking()
                .Where(l => l.Status == ListingStatus.Approved)
                .Select(l => new { l.Asset.Address.City, l.Asset.Address.District })
                .Distinct()
                .ToListAsync(ct);

            var system = BuildSystemPrompt(areas.Select(a => (a.City, a.District)).ToList());
            var user = BuildUserMessage(req);

            var completion = await _groq.CompleteJsonAsync(system, user, "search_intent", Schema, ct, forceModel);
            var parsed = JsonNode.Parse(completion.Json)?.AsObject() ?? new JsonObject();

            var result = Validate(parsed, req, areas.Select(a => (a.City, a.District)).ToList());
            _logger.LogInformation(
                "Trợ lý tìm nhà: {Model} {Ms}ms {Tokens} token, {Unrecognized} mục không hiểu",
                completion.Model, completion.LatencyMs, completion.TotalTokens, result.Unrecognized.Count);

            return result with
            {
                Model = completion.Model, LatencyMs = completion.LatencyMs, TotalTokens = completion.TotalTokens,
            };
        }

        // ==================== Prompt ====================

        private static readonly (int Code, string Label)[] PropertyTypes =
        {
            (1, "Nhà riêng"), (2, "Căn hộ / chung cư"), (3, "Đất / đất nền"), (4, "Biệt thự"),
            (5, "Nhà mặt phố / shophouse"), (6, "Văn phòng"), (7, "Phòng trọ"),
            (8, "Mặt bằng kinh doanh"), (9, "Kho, nhà xưởng"),
        };

        private static readonly (string Key, string Label)[] Amenities =
        {
            ("air_conditioner", "máy lạnh"), ("water_heater", "nóng lạnh"), ("private_bathroom", "WC riêng"),
            ("private_kitchen", "bếp riêng"), ("loft", "gác lửng"), ("balcony", "ban công"),
            ("window", "cửa sổ"), ("wifi", "wifi"), ("parking", "chỗ để xe"), ("elevator", "thang máy"),
            ("security", "bảo vệ/camera"), ("furnished", "nội thất đầy đủ"),
            ("washing_machine", "máy giặt"), ("fridge", "tủ lạnh"),
        };

        /// <summary>Prompt viết bằng tiếng Anh, ví dụ bằng tiếng Việt: tiếng Việt tốn token gấp
        /// nhiều lần tiếng Anh, mà gói Groq miễn phí chỉ cho 8000 token/phút cho cả hệ thống. Bản
        /// đầu viết bằng tiếng Việt tốn ~2300 token/lượt — chỉ đủ ~3 câu hỏi mỗi phút.</summary>
        private static string BuildSystemPrompt(List<(string City, string District)> areas)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Convert a Vietnamese real-estate search request into the JSON filter. Extract only what the user states; unknown fields = null or [].");
            sb.AppendLine($"Today: {DateTime.UtcNow.AddHours(7):yyyy-MM-dd}.");
            sb.AppendLine("Rules:");
            sb.AppendLine("- type 1=buy (mua/bán), 2=rent (thuê).");
            sb.AppendLine("- Money in VND: 7 triệu/7tr=7000000; 2tr5=2500000; 3 tỷ/3 tỏi=3000000000; 2 tỷ 5=2500000000; 500k=500000. dưới/tối đa X → priceMax; trên/từ X → priceMin; khoảng/tầm/cỡ X → priceApprox X (leave priceMin/priceMax null).");
            sb.AppendLine("- Rent: plain rent price → priceMax. Only when user says tổng chi phí / bao gồm phí / tất cả → totalCostMax.");
            sb.AppendLine("- 2PN=bedroomsMin 2; 2WC=bathroomsMin 2; 3 tầng/3 lầu=floorsMin 3; mặt tiền/ngang 5m=frontageMin 5; 80-120m2=areaMin/areaMax.");
            sb.AppendLine("- propertyTypes codes: 1 nhà riêng, 2 căn hộ/chung cư, 3 đất/đất nền, 4 biệt thự, 5 nhà mặt phố/shophouse, 6 văn phòng, 7 phòng trọ, 8 mặt bằng kinh doanh, 9 kho/xưởng. Generic \"nhà\" when buying → [1,5,4]; \"phòng/trọ\" when renting → [7].");
            sb.AppendLine("- directions ⊂ [" + string.Join(", ", PropertyVocabulary.Directions) + "]; furnitureStates ⊂ [" + string.Join(", ", PropertyVocabulary.FurnitureStates) + "].");
            sb.AppendLine("- legalStatuses ⊂ [" + string.Join(", ", PropertyVocabulary.LegalStatuses) + "]. \"có sổ\"/sổ hồng/sổ đỏ in general → [Sổ hồng riêng, Sổ hồng chung, Sổ đỏ].");
            sb.AppendLine("- petsAllowed=true if the user has/keeps a pet (nuôi chó/mèo/thú cưng). sharedWithOwner=false for \"không chung chủ\". curfewFree=true for \"giờ giấc tự do\". availableBy=YYYY-MM-DD move-in deadline.");
            sb.AppendLine("- Amenities default to preferences (soft). Put a key in amenities ONLY if the user says bắt buộc/phải có. Keys: air_conditioner, water_heater, private_bathroom, private_kitchen, loft, balcony, window, wifi, parking, elevator, security, furnished, washing_machine, fridge.");
            sb.AppendLine("- preferences: short Vietnamese soft wishes, 1-4 words each (\"yên tĩnh\", \"ban công\", \"gần chợ\", \"hẻm xe hơi\"). Do not repeat hard conditions.");
            sb.AppendLine("- anchorText: a place to live NEAR (workplace, school, street, landmark), copied as written. With travelMinutes+travelMode (walking/cycling/driving; xe máy & ô tô = driving) if time is given, else radiusKm if distance is given; plain \"gần\" → radiusKm 3.");
            sb.AppendLine("- city/district: copy EXACTLY from the list below. A named place (school, street) is anchorText, not district. Area not in the list → null and add a short note to unrecognized.");
            sb.AppendLine("- keyword: only a required proper name (project like Vinhomes), else null.");
            sb.AppendLine("- unrecognized: only real user requirements that cannot be expressed by the fields (short Vietnamese). Never add notes about fields the user did not mention.");
            sb.AppendLine("- If CURRENT STATE is given, the message adjusts it: return the FULL updated filter. \"rẻ hơn chút\" → lower the price max ~10-15%; \"bỏ X\" → clear X.");
            sb.AppendLine("Areas with listings (city: districts):");
            foreach (var g in areas.GroupBy(a => a.City).OrderBy(g => g.Key))
                sb.AppendLine($"{g.Key}: {string.Join(" | ", g.Select(x => x.District).Distinct().OrderBy(x => x))}");
            return sb.ToString();
        }

        private static string BuildUserMessage(AssistantSearchRequest req)
        {
            if (req.Current is null && (req.CurrentPreferences is null || req.CurrentPreferences.Count == 0) && req.CurrentAnchor is null)
                return req.Message.Trim();

            var state = new JsonObject
            {
                ["criteria"] = JsonSerializer.SerializeToNode(req.Current, JsonOpts),
                ["preferences"] = JsonSerializer.SerializeToNode(req.CurrentPreferences ?? new List<string>()),
                ["anchor"] = JsonSerializer.SerializeToNode(req.CurrentAnchor, JsonOpts),
            };
            return "CURRENT STATE:\n" + state.ToJsonString() + "\n\nNEW MESSAGE:\n" + req.Message.Trim();
        }

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        // ==================== Lược đồ JSON (strict) ====================

        private static JsonObject Nullable(string type) => new() { ["type"] = new JsonArray(type, "null") };
        private static JsonObject StrArray() => new() { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "string" } };

        private static readonly JsonObject Schema = BuildSchema();

        private static JsonObject BuildSchema()
        {
            var props = new JsonObject
            {
                ["type"] = new JsonObject { ["type"] = new JsonArray("integer", "null"), ["enum"] = new JsonArray(1, 2, null) },
                ["propertyTypes"] = new JsonObject { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "integer" } },
                ["city"] = Nullable("string"),
                ["district"] = Nullable("string"),
                ["priceMin"] = Nullable("number"),
                ["priceMax"] = Nullable("number"),
                ["priceApprox"] = Nullable("number"),
                ["totalCostMax"] = Nullable("number"),
                ["areaMin"] = Nullable("number"),
                ["areaMax"] = Nullable("number"),
                ["bedroomsMin"] = Nullable("integer"),
                ["bathroomsMin"] = Nullable("integer"),
                ["floorsMin"] = Nullable("integer"),
                ["frontageMin"] = Nullable("number"),
                ["directions"] = StrArray(),
                ["legalStatuses"] = StrArray(),
                ["furnitureStates"] = StrArray(),
                ["petsAllowed"] = Nullable("boolean"),
                ["curfewFree"] = Nullable("boolean"),
                ["sharedWithOwner"] = Nullable("boolean"),
                ["availableBy"] = Nullable("string"),
                ["amenities"] = StrArray(),
                ["keyword"] = Nullable("string"),
                ["preferences"] = StrArray(),
                ["anchorText"] = Nullable("string"),
                ["travelMinutes"] = Nullable("integer"),
                ["travelMode"] = new JsonObject
                {
                    ["type"] = new JsonArray("string", "null"),
                    ["enum"] = new JsonArray("walking", "cycling", "driving", null),
                },
                ["radiusKm"] = Nullable("number"),
                ["unrecognized"] = StrArray(),
            };
            var required = new JsonArray();
            foreach (var kv in props) required.Add(kv.Key);
            return new JsonObject
            {
                ["type"] = "object",
                ["additionalProperties"] = false,
                ["properties"] = props,
                ["required"] = required,
            };
        }

        // ==================== Kiểm tra lại đầu ra của LLM ====================

        public static AssistantSearchResult Validate(
            JsonObject o, AssistantSearchRequest req, List<(string City, string District)> areas)
        {
            var unrecognized = Strings(o, "unrecognized").Take(6).ToList();

            ListingType? type = Int(o, "type") switch { 1 => ListingType.Sale, 2 => ListingType.Rent, _ => req.Current?.Type };

            // ---- Khu vực: chỉ nhận đúng giá trị có thật ----
            string? city = null, district = null;
            var rawCity = Str(o, "city");
            var rawDistrict = Str(o, "district");
            // Cùng một thành phố có thể đang lưu bằng nhiều cách viết ("TP. Hồ Chí Minh" và
            // "Thành phố Hồ Chí Minh"). Bộ lọc so khớp chữ chính xác, nên chọn MỘT cách viết sẽ
            // bỏ sót tin của cách kia. Khi gặp nhiều cách viết thì không lọc theo thành phố —
            // tên quận đủ cụ thể để lọc một mình.
            if (rawDistrict is not null)
            {
                var hits = areas.Where(a => Key(a.District) == Key(rawDistrict)
                                            && (rawCity is null || Key(a.City) == Key(rawCity))).ToList();
                if (hits.Count > 0)
                {
                    district = hits[0].District;
                    city = hits.Select(h => h.City).Distinct().Count() == 1 ? hits[0].City : null;
                }
                else unrecognized.Add($"Khu vực \"{rawDistrict}\" chưa có tin nào");
            }
            else if (rawCity is not null)
            {
                var cities = areas.Where(a => Key(a.City) == Key(rawCity)).Select(a => a.City).Distinct().ToList();
                if (cities.Count == 1) city = cities[0];
                else if (cities.Count == 0) unrecognized.Add($"Tỉnh/thành \"{rawCity}\" chưa có tin nào");
            }

            decimal? Money(string k) => Num(o, k) is double v && v > 0 && v < 1e14 ? (decimal)Math.Round(v) : null;
            double? Positive(string k, double max) => Num(o, k) is double v && v > 0 && v <= max ? v : null;
            int? Count(string k, int max) => Int(o, k) is int v && v > 0 && v <= max ? v : null;

            // Thuê mà giá trên 2 tỷ/tháng là phi lý — gần như chắc chắn mô hình đọc nhầm đơn vị
            // ("2tr5" thành 2,5 tỷ: bắt được trong bộ đánh giá). Lọc theo con số đó cho ra danh
            // sách vô nghĩa, nên hiểu là nhầm nghìn lần và sửa lại.
            var isRent = type == ListingType.Rent;
            decimal? Fix(decimal? v) => isRent && v > 2_000_000_000m ? Math.Round(v.Value / 1000m) : v;

            var priceMin = Fix(Money("priceMin"));
            var priceMax = Fix(Money("priceMax"));
            // "khoảng / tầm X" → ±10%. Đổi ở đây bằng quy tắc thay vì để mô hình tự tính: bộ đánh
            // giá cho thấy mô hình thường chỉ điền priceMax = X, làm mất nửa dưới của khoảng.
            if (Fix(Money("priceApprox")) is decimal approx && priceMin is null && priceMax is null)
            {
                priceMin = Math.Round(approx * 0.9m);
                priceMax = Math.Round(approx * 1.1m);
            }
            if (priceMin > priceMax) (priceMin, priceMax) = (priceMax, priceMin);
            var areaMin = Positive("areaMin", 1_000_000);
            var areaMax = Positive("areaMax", 1_000_000);
            if (areaMin > areaMax) (areaMin, areaMax) = (areaMax, areaMin);

            var propertyTypes = Ints(o, "propertyTypes")
                .Where(v => Enum.IsDefined(typeof(AssetDomainType), v) && v != (int)AssetDomainType.Other)
                .Select(v => (AssetDomainType)v).Distinct().ToList();

            DateTime? availableBy = null;
            if (Str(o, "availableBy") is string d
                && DateTime.TryParseExact(d, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt)
                && dt >= DateTime.UtcNow.Date.AddDays(-1) && dt <= DateTime.UtcNow.AddYears(2))
                availableBy = dt;

            // Tiện nghi chỉ thành điều kiện CỨNG khi người dùng nhấn mạnh. Mô hình hay bỏ qua quy tắc
            // này (bộ đánh giá: "có máy lạnh" → bắt buộc máy lạnh), mà điều kiện cứng thì loại oan
            // những căn có máy lạnh nhưng chủ chưa khai. Nên kiểm tra lại bằng chính câu người dùng;
            // tiện nghi đã cứng từ câu trước (đang điều chỉnh) thì giữ nguyên.
            var emphasised = Emphasis.IsMatch(req.Message);
            var keptBefore = req.Current?.Amenities ?? new List<string>();
            var hardAmenities = new List<string>();
            var softFromAmenities = new List<string>();
            foreach (var a in ListingSearchFilter.NormalizeAmenities(Strings(o, "amenities")))
            {
                if (emphasised || keptBefore.Contains(a)) hardAmenities.Add(a);
                else softFromAmenities.Add(AmenityLabel(a));
            }

            // Điều kiện chỉ có nghĩa với thuê thì bỏ khi đang tìm mua — để không âm thầm lọc
            // tin bán theo một trường mà tin bán không bao giờ khai.
            var rent = type != ListingType.Sale;

            var criteria = new PublicListingSearchQuery(
                Type: type,
                City: city,
                District: district,
                PriceMin: priceMin,
                PriceMax: priceMax,
                BedroomsMin: Count("bedroomsMin", 50),
                Keyword: Str(o, "keyword") is string kw && kw.Length <= 60 ? kw : null,
                // Toạ độ không do LLM quyết định: điểm neo (anchorText) được giao diện tìm trên
                // bản đồ, người dùng thấy và kéo lại được.
                Latitude: req.Current?.Latitude,
                Longitude: req.Current?.Longitude,
                RadiusMeters: req.Current?.RadiusMeters,
                TotalCostMax: rent ? Fix(Money("totalCostMax")) : null,
                PetsAllowed: rent ? Bool(o, "petsAllowed") : null,
                CurfewFree: rent ? Bool(o, "curfewFree") : null,
                SharedWithOwner: rent ? Bool(o, "sharedWithOwner") : null,
                AvailableBy: availableBy,
                Amenities: hardAmenities.Count > 0 ? hardAmenities : null,
                SortBy: null,
                PropertyTypes: propertyTypes.Count > 0 ? propertyTypes : null,
                AreaMin: areaMin,
                AreaMax: areaMax,
                BathroomsMin: Count("bathroomsMin", 50),
                FloorsMin: Count("floorsMin", 200),
                FrontageMin: Positive("frontageMin", 1000),
                Directions: PropertyVocabulary.NormalizeFilter(Strings(o, "directions"), PropertyVocabulary.NormalizeDirection, PropertyVocabulary.Directions),
                LegalStatuses: type == ListingType.Rent ? null : WidenTitle(
                    PropertyVocabulary.NormalizeFilter(Strings(o, "legalStatuses"), PropertyVocabulary.NormalizeLegal, PropertyVocabulary.LegalStatuses)),
                FurnitureStates: PropertyVocabulary.NormalizeFilter(Strings(o, "furnitureStates"), PropertyVocabulary.NormalizeFurniture, PropertyVocabulary.FurnitureStates));

            var preferences = SoftPreferences.Parse(
                string.Join(';', Strings(o, "preferences").Concat(softFromAmenities)));

            AssistantAnchorDto? anchor = null;
            if (Str(o, "anchorText") is string at && at.Length is > 1 and <= 120)
            {
                var minutes = Int(o, "travelMinutes") is int m && m is >= 5 and <= 60 ? m : (int?)null;
                var mode = Str(o, "travelMode") is "walking" or "cycling" or "driving" ? Str(o, "travelMode") : null;
                var radius = Num(o, "radiusKm") is double r && r is >= 0.3 and <= 50 ? r : (double?)null;
                if (minutes is null && radius is null) radius = 3;
                anchor = new AssistantAnchorDto(at, minutes, minutes is null ? null : mode ?? "driving", minutes is null ? radius : null);
            }

            return new AssistantSearchResult(criteria, preferences, anchor, unrecognized.Distinct().ToList(), "", 0, 0);
        }

        private static readonly System.Text.RegularExpressions.Regex Emphasis = new(
            @"bắt buộc|phải có|nhất định|nhất thiết|không thể thiếu|cần phải có",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static string AmenityLabel(string key)
            => Amenities.FirstOrDefault(a => a.Key == key).Label ?? key;

        /// <summary>"Sổ đỏ" và "sổ hồng" nay là cùng một loại giấy chứng nhận quyền sử dụng đất
        /// (thống nhất từ 2009); người mua nói "có sổ đỏ" hay "có sổ hồng" đều có nghĩa là "có
        /// sổ". Chỉ khi họ nói rõ "sổ riêng" / "sổ chung" mới giữ đúng loại đó.</summary>
        private static List<string>? WidenTitle(List<string>? legal)
        {
            if (legal is null) return null;
            var titles = new[] { "Sổ hồng riêng", "Sổ hồng chung", "Sổ đỏ" };
            var onlyRed = legal.Count == 1 && legal[0] == "Sổ đỏ";
            var bothPink = legal.Count == 2 && legal.Contains("Sổ hồng riêng") && legal.Contains("Sổ hồng chung");
            return onlyRed || bothPink ? titles.ToList() : legal;
        }

        private static string? Str(JsonObject o, string k)
            => o[k] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) ? s.Trim() : null;
        private static double? Num(JsonObject o, string k)
            => o[k] is JsonValue v && v.TryGetValue<double>(out var d) && double.IsFinite(d) ? d : null;
        private static int? Int(JsonObject o, string k) => Num(o, k) is double d ? (int)Math.Round(d) : null;
        private static bool? Bool(JsonObject o, string k)
            => o[k] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : null;
        private static IEnumerable<string> Strings(JsonObject o, string k)
            => o[k] is JsonArray a ? a.Select(x => x is JsonValue v && v.TryGetValue<string>(out var s) ? s : null)
                .Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!.Trim()) : Enumerable.Empty<string>();
        private static IEnumerable<int> Ints(JsonObject o, string k)
            => o[k] is JsonArray a ? a.Select(x => x is JsonValue v && v.TryGetValue<double>(out var d) ? (int?)Math.Round(d) : null)
                .Where(i => i is not null).Select(i => i!.Value) : Enumerable.Empty<int>();

        /// <summary>So khớp tên khu vực không phụ thuộc dấu, hoa thường hay tiền tố hành chính:
        /// "Hồ Chí Minh" khớp "TP. Hồ Chí Minh", "Bình Thạnh" khớp "Quận Bình Thạnh". Tiền tố
        /// chỉ bị bỏ khi phần còn lại không phải con số — "Quận 3" giữ nguyên, vì "3" trơn trọi
        /// thì quá dễ nhầm.</summary>
        private static string Key(string s)
        {
            var u = SoftPreferences.Unaccent(s).Replace(".", " ");
            var words = u.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            string[][] prefixes =
            {
                new[] { "thanh", "pho" }, new[] { "tp" }, new[] { "tinh" },
                new[] { "quan" }, new[] { "huyen" }, new[] { "thi", "xa" }, new[] { "phuong" },
            };
            foreach (var p in prefixes)
            {
                if (words.Count > p.Length && words.Take(p.Length).SequenceEqual(p)
                    && !words.Skip(p.Length).All(w => w.All(char.IsDigit)))
                {
                    words = words.Skip(p.Length).ToList();
                    break;
                }
            }
            return string.Join(' ', words);
        }
    }
}

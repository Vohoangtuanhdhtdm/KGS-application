using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace kgs_api.Services.Assistant
{
    /// <summary>Cấu hình Groq (appsettings: "Groq"). Khoá API chỉ nằm trong
    /// appsettings.Development.json / biến môi trường — không bao giờ trong mã nguồn.</summary>
    public sealed class GroqSettings
    {
        public string ApiKey { get; set; } = string.Empty;
        public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";
        /// <summary>Mô hình chính. gpt-oss-120b: hiểu tiếng Việt tốt nhất trong các mô hình
        /// Groq miễn phí đã thử, trả JSON đúng lược đồ trong ~0,4 giây.</summary>
        public string Model { get; set; } = "openai/gpt-oss-120b";
        /// <summary>Dùng khi mô hình chính hết hạn mức (429) hoặc lỗi.</summary>
        /// <summary>qwen: nhanh và tốn ít token nhất, nhưng trong bộ đánh giá hay nhầm đơn vị tiền
        /// ("trên 20 tỷ" thành 2 tỷ) — nên chỉ là dự phòng, không phải mô hình chính.</summary>
        public string FallbackModel { get; set; } = "qwen/qwen3.8-27b";
        /// <summary>Mỗi mô hình có hạn mức token/phút RIÊNG — chuyển mô hình khi một cái hết hạn
        /// mức là cách rẻ nhất để giữ trợ lý chạy trong buổi demo.</summary>
        public string[] ExtraFallbackModels { get; set; } = { "openai/gpt-oss-20b" };
        public int TimeoutSeconds { get; set; } = 20;
    }

    public sealed record GroqCompletion(string Json, string Model, int TotalTokens, long LatencyMs);

    public sealed class GroqUnavailableException : Exception
    {
        public GroqUnavailableException(string message, Exception? inner = null) : base(message, inner) { }
    }

    /// <summary>Gọi Groq (API tương thích OpenAI) và ép kết quả về JSON theo lược đồ (strict).</summary>
    public sealed class GroqChatClient
    {
        private readonly HttpClient _http;
        private readonly GroqSettings _settings;
        private readonly ILogger<GroqChatClient> _logger;

        public GroqChatClient(HttpClient http, IOptions<GroqSettings> settings, ILogger<GroqChatClient> logger)
        {
            _http = http; _settings = settings.Value; _logger = logger;
            _http.BaseAddress = new Uri(_settings.BaseUrl);
            _http.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
        }

        public bool Configured => !string.IsNullOrWhiteSpace(_settings.ApiKey);

        public async Task<GroqCompletion> CompleteJsonAsync(
            string system, string user, string schemaName, JsonObject schema, CancellationToken ct,
            string? forceModel = null)
        {
            if (!Configured) throw new GroqUnavailableException("Chưa cấu hình khoá Groq.");

            // forceModel (chỉ dùng khi đánh giá): đo đúng một mô hình, không lùi sang mô hình khác —
            // nếu lùi, số đo của mô hình này sẽ lẫn kết quả của mô hình kia.
            var models = forceModel is not null
                ? new[] { forceModel }
                : new[] { _settings.Model, _settings.FallbackModel }
                    .Concat(_settings.ExtraFallbackModels).Where(m => !string.IsNullOrWhiteSpace(m)).Distinct();
            foreach (var model in models)
            {
                var body = new JsonObject
                {
                    ["model"] = model,
                    ["temperature"] = 0,
                    ["messages"] = new JsonArray
                    {
                        new JsonObject { ["role"] = "system", ["content"] = system },
                        new JsonObject { ["role"] = "user", ["content"] = user },
                    },
                    ["response_format"] = new JsonObject
                    {
                        ["type"] = "json_schema",
                        ["json_schema"] = new JsonObject
                        {
                            ["name"] = schemaName,
                            ["strict"] = true,
                            ["schema"] = schema.DeepClone(),
                        },
                    },
                };
                // Mô hình suy luận (gpt-oss): suy luận ngắn là đủ cho việc trích điều kiện, và
                // không trả phần suy luận về — chỉ cần JSON.
                if (model.StartsWith("openai/gpt-oss", StringComparison.Ordinal))
                {
                    body["reasoning_effort"] = "low";
                    body["include_reasoning"] = false;
                }

                using var req = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
                {
                    Content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json"),
                };
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);

                var started = System.Diagnostics.Stopwatch.StartNew();
                try
                {
                    using var res = await _http.SendAsync(req, ct);
                    var text = await res.Content.ReadAsStringAsync(ct);
                    if (!res.IsSuccessStatusCode)
                    {
                        // Không ghi nội dung câu hỏi vào log — đó là nhu cầu riêng tư của người dùng.
                        // Không ghi nội dung câu hỏi — đó là nhu cầu riêng tư. Phần lỗi của Groq thì
                        // ghi (đã cắt ngắn) để biết vì sao: hết hạn mức, sai lược đồ...
                        _logger.LogWarning("Groq {Model} trả {Status}: {Error}", model, (int)res.StatusCode,
                            text.Length > 300 ? text[..300] : text);
                        continue;   // thử mô hình dự phòng
                    }

                    using var doc = JsonDocument.Parse(text);
                    var content = doc.RootElement.GetProperty("choices")[0]
                        .GetProperty("message").GetProperty("content").GetString() ?? "{}";
                    var tokens = doc.RootElement.TryGetProperty("usage", out var u)
                                 && u.TryGetProperty("total_tokens", out var t) ? t.GetInt32() : 0;
                    return new GroqCompletion(content, model, tokens, started.ElapsedMilliseconds);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException
                                           && !ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Gọi Groq {Model} thất bại", model);
                }
            }

            throw new GroqUnavailableException("Trợ lý tạm thời không phản hồi.");
        }
    }
}

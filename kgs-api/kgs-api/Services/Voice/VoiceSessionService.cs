using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace kgs_api.Services.Voice
{
    public sealed record VoiceSessionResult(string Token, string Model, DateTimeOffset ExpiresAt);

    /// <summary>Xin token tạm của Gemini Live cho trình duyệt.
    ///
    /// Khoá thật không bao giờ rời máy chủ. Token chỉ dùng được MỘT lần, phải mở phiên trong 1 phút,
    /// và khoá cứng mô hình, giọng, lời dặn, công cụ, cách chia lượt — trình duyệt có lấy được token
    /// cũng không đổi được KiGi thành thứ khác.
    ///
    /// Giống dịch vụ định giá: giọng nói là thứ có thì tốt. Mọi lỗi quy về null, và Trang chủ chỉ đơn
    /// giản không hiện nút micro.</summary>
    public sealed class VoiceSessionService
    {
        private readonly HttpClient _http;
        private readonly GeminiSettings _settings;
        private readonly TimeProvider _clock;
        private readonly ILogger<VoiceSessionService> _logger;

        public VoiceSessionService(
            HttpClient http, IOptions<GeminiSettings> settings, TimeProvider clock,
            ILogger<VoiceSessionService> logger)
        {
            _http = http;
            _settings = settings.Value;
            _clock = clock;
            _logger = logger;
        }

        public bool Enabled => !string.IsNullOrWhiteSpace(_settings.ApiKey);

        public async Task<VoiceSessionResult?> CreateAsync(CancellationToken ct)
        {
            if (!Enabled) return null;

            var now = _clock.GetUtcNow();
            var body = BuildTokenRequest(_settings, now);
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "v1beta/auth_tokens")
                {
                    Content = JsonContent.Create(body),
                };
                req.Headers.Add("x-goog-api-key", _settings.ApiKey);

                using var res = await _http.SendAsync(req, ct);
                if (!res.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Gemini từ chối tạo token tạm: {Status}.", (int)res.StatusCode);
                    return null;
                }

                var json = await res.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: ct);
                var token = (string?)json?["name"];
                if (string.IsNullOrEmpty(token)) return null;

                return new VoiceSessionResult(token, _settings.LiveModel, now.AddMinutes(_settings.SessionMinutes + 1));
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Không tạo được token tạm của Gemini.");
                return null;
            }
        }

        /// <summary>Thân yêu cầu REST thật của v1beta/auth_tokens. "liveConnectConstraints" chỉ là tên
        /// trong SDK — API nhận "bidiGenerateContentSetup", và "fieldMask" liệt kê các trường bị khoá.</summary>
        internal static JsonObject BuildTokenRequest(GeminiSettings s, DateTimeOffset now) => new()
        {
            ["uses"] = 1,
            ["expireTime"] = Iso(now.AddMinutes(s.SessionMinutes + 1)),
            ["newSessionExpireTime"] = Iso(now.AddMinutes(1)),
            ["bidiGenerateContentSetup"] = new JsonObject
            {
                ["model"] = $"models/{s.LiveModel}",
                ["generationConfig"] = new JsonObject
                {
                    ["responseModalities"] = new JsonArray { "AUDIO" },
                    ["speechConfig"] = new JsonObject
                    {
                        ["voiceConfig"] = new JsonObject
                        {
                            ["prebuiltVoiceConfig"] = new JsonObject { ["voiceName"] = s.Voice },
                        },
                    },
                },
                ["systemInstruction"] = new JsonObject
                {
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = KiGiPrompt.SystemInstruction } },
                    ["role"] = "user",
                },
                ["tools"] = KiGiPrompt.Tools(),
                ["inputAudioTranscription"] = new JsonObject(),
                ["outputAudioTranscription"] = new JsonObject(),
                // Lượt nói do trình duyệt đánh dấu ("chạm để nói"): bài thử cho thấy tự phát hiện
                // lượt nói của Gemini bỏ lỡ một số đoạn nói.
                ["realtimeInputConfig"] = new JsonObject
                {
                    ["automaticActivityDetection"] = new JsonObject { ["disabled"] = true },
                },
            },
            ["fieldMask"] = "model,generationConfig.responseModalities,generationConfig.speechConfig,"
                + "systemInstruction.parts,systemInstruction.role,tools,"
                + "inputAudioTranscription,outputAudioTranscription,realtimeInputConfig",
        };

        private static string Iso(DateTimeOffset t) => t.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'");
    }
}

using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using kgs_api.Services.Voice;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace kgs_api.Tests;

/// <summary>Cấp phiên giọng nói: khoá Gemini ở lại máy chủ, trình duyệt chỉ nhận token tạm khoá cứng
/// mô hình, lời dặn, công cụ và cách chia lượt nói.</summary>
public class VoiceSessionTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 18, 10, 0, 0, TimeSpan.Zero);

    private sealed class FixedTime : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class CapturingHandler(Func<HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Calls;
        public HttpRequestMessage? Request;
        public string? Body;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Calls++;
            Request = r;
            Body = r.Content is null ? null : await r.Content.ReadAsStringAsync(ct);
            return respond();
        }
    }

    private static HttpResponseMessage Json(HttpStatusCode code, string json) =>
        new(code) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static VoiceSessionService Service(HttpMessageHandler h, string key = "khoa-thu")
        => new(
            new HttpClient(h) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
            Options.Create(new GeminiSettings { ApiKey = key }),
            new FixedTime(),
            NullLogger<VoiceSessionService>.Instance);

    [Fact]
    public async Task ThieuKhoa_TraNull_KhongGoiGoogle()
    {
        var h = new CapturingHandler(() => Json(HttpStatusCode.OK, "{\"name\":\"auth_tokens/x\"}"));
        var svc = Service(h, key: "");

        Assert.False(svc.Enabled);
        Assert.Null(await svc.CreateAsync(CancellationToken.None));
        Assert.Equal(0, h.Calls);
    }

    [Fact]
    public async Task YeuCauToken_DungRangBuoc()
    {
        var h = new CapturingHandler(() => Json(HttpStatusCode.OK, "{\"name\":\"auth_tokens/abc\"}"));
        await Service(h).CreateAsync(CancellationToken.None);

        Assert.Equal(HttpMethod.Post, h.Request!.Method);
        Assert.Equal("/v1beta/auth_tokens", h.Request.RequestUri!.AbsolutePath);
        Assert.Equal("khoa-thu", h.Request.Headers.GetValues("x-goog-api-key").Single());

        var body = JsonNode.Parse(h.Body!)!;
        Assert.Equal(1, (int)body["uses"]!);
        Assert.Equal("2026-10-18T10:04:00Z", (string)body["expireTime"]!);
        Assert.Equal("2026-10-18T10:01:00Z", (string)body["newSessionExpireTime"]!);

        var setup = body["bidiGenerateContentSetup"]!;
        Assert.Equal("models/gemini-3.8-live", (string)setup["model"]!);
        Assert.Equal("AUDIO", (string)setup["generationConfig"]!["responseModalities"]![0]!);
        Assert.Equal("Kore",
            (string)setup["generationConfig"]!["speechConfig"]!["voiceConfig"]!["prebuiltVoiceConfig"]!["voiceName"]!);
        Assert.NotNull(setup["inputAudioTranscription"]);
        Assert.NotNull(setup["outputAudioTranscription"]);
        Assert.True((bool)setup["realtimeInputConfig"]!["automaticActivityDetection"]!["disabled"]!);

        var prompt = (string)setup["systemInstruction"]!["parts"]![0]!["text"]!;
        Assert.Contains("KiGi", prompt);
        Assert.Contains("giữ nguyên", prompt);
        // 0 căn mà không có gợi ý nới: KiGi không được tự bịa khu vực hay mức giá khác.
        Assert.Contains("goi_y_noi rỗng", prompt);

        var names = setup["tools"]![0]!["functionDeclarations"]!.AsArray()
            .Select(f => (string)f!["name"]!).ToArray();
        Assert.Equal(new[] { "cap_nhat_nhu_cau", "mo_ket_qua" }, names);

        var mask = ((string)body["fieldMask"]!).Split(',');
        Assert.Equal(new[]
        {
            "model", "generationConfig.responseModalities", "generationConfig.speechConfig",
            "systemInstruction.parts", "systemInstruction.role", "tools",
            "inputAudioTranscription", "outputAudioTranscription", "realtimeInputConfig",
        }, mask);
    }

    [Fact]
    public async Task GoogleTra500_TraNull()
    {
        var h = new CapturingHandler(() => Json(HttpStatusCode.InternalServerError, "{}"));
        Assert.Null(await Service(h).CreateAsync(CancellationToken.None));
    }

    [Fact]
    public async Task KhongKetNoiDuoc_TraNull()
    {
        var h = new CapturingHandler(() => throw new HttpRequestException("Connection refused"));
        Assert.Null(await Service(h).CreateAsync(CancellationToken.None));
    }

    [Fact]
    public async Task TraTokenTuTruongName()
    {
        var h = new CapturingHandler(() => Json(HttpStatusCode.OK, "{\"name\":\"auth_tokens/abc\"}"));
        var r = await Service(h).CreateAsync(CancellationToken.None);

        Assert.NotNull(r);
        Assert.Equal("auth_tokens/abc", r!.Token);
        Assert.Equal("gemini-3.8-live", r.Model);
        Assert.Equal(Now.AddMinutes(4), r.ExpiresAt);
    }
}

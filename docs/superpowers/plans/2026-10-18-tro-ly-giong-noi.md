# Trợ lý giọng nói KiGi — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lối vào bằng giọng nói cho ô "Tìm nhà bằng một câu" ở Trang chủ: mascot KiGi trò chuyện tiếng Việt qua Gemini Live, hỏi bù điều còn thiếu, dựng bộ lọc qua pipeline `search-intent` sẵn có rồi chuyển sang trang Tìm nhà.

**Architecture:** .NET cấp token tạm của Gemini (khoá thật ở máy chủ, mô hình + lời dặn + công cụ khoá cứng trong token). Trình duyệt nói chuyện thẳng với Gemini Live qua WebSocket; khi mô hình gọi công cụ, trình duyệt gọi API KGS hiện có và trả kết quả về. Mascot SVG chỉ vẽ theo trạng thái + âm lượng.

**Tech Stack:** ASP.NET Core 8 (`HttpClient`, `TimeProvider`, rate limiter), xUnit; React 19 + TanStack Router, `@google/genai` 2.30.0 (Live), Web Audio API (AudioWorklet), Vitest 5.0.5.

**Spec:** `docs/superpowers/specs/2026-10-18-tro-ly-giong-noi-design.md`

## Global Constraints

- Chỉ dùng gói miễn phí của Gemini API; mô hình chính `gemini-3.8-live`, dự phòng `gemini-3.1-flash-live-preview` (đổi bằng cấu hình `Gemini:LiveModel`).
- Khoá Gemini chỉ nằm trong `kgs-api/kgs-api/appsettings.Development.json` (đã gitignore); `appsettings.json` để `"ApiKey": ""`. Trước mỗi commit chạy quét `git diff --cached | grep -E 'AQ\.[A-Za-z0-9_-]{20}|AIza|gsk_|pk\.eyJ|sk\.eyJ'` — phải rỗng.
- Token tạm: `uses = 1`, `newSessionExpireTime` = bây giờ + 1 phút, `expireTime` = bây giờ + 4 phút; endpoint `v1beta/auth_tokens`.
- Lượt nói do trình duyệt điều khiển ("chạm để nói"): `automaticActivityDetection.disabled = true`; lượt kết thúc sau **1,2 giây** im lặng (sau khi đã có tiếng), chạm lại, hoặc **15 giây**.
- Phiên tối đa **3 phút**; **20 giây** không chạm micro sau khi KiGi nói xong thì KiGi chào và đóng; tối đa **3 câu hỏi bù**; mỗi lượt KiGi tối đa **2 câu**.
- Giới hạn tạo phiên: **5 phiên / 10 phút / IP** (chính sách rate limit `voice`).
- Thứ tự "còn thiếu": **thuê hay mua → khu vực → ngân sách → loại nhà**.
- Khoá bàn giao `sessionStorage`: `kgs:tro-ly-ban-giao`; tham số URL trang Tìm nhà: `tro_ly=1`.
- Dòng riêng tư dưới nút micro, nguyên văn: "Giọng nói được xử lý bởi Google Gemini".
- Mọi chữ hiển thị và lời KiGi bằng tiếng Việt; mascot không dùng thư viện hoạt ảnh mới, tôn trọng `prefers-reduced-motion`.
- Giao diện, `search-intent` và trang Tìm nhà hiện có phải chạy y như cũ khi giọng nói tắt hoặc hỏng.

## Review Focus

1. **Số căn khi có điểm neo đi lại** — đếm qua API tìm kiếm không tính vùng thời gian (cần Mapbox), nên số KiGi đọc có thể lớn hơn số trang Tìm nhà hiện. Mong đợi: KiGi nói "khoảng N căn". → Task 3 test `uoc_tinh` khi `anchor.travelMinutes` có giá trị.
2. **Hạn mức trợ lý dùng chung** — mỗi lượt nói gọi `search-intent` (20 câu / 10 phút / IP), tập demo vài lần là chạm 429. Mong đợi: KiGi xin thử lại chứ không treo; máy dev nới hạn mức khi tập. → Task 3 test lỗi trả `loi`; Task 7 bước cấu hình `RateLimits:Assistant`.
3. **Rời trang giữa phiên** — micro phải tắt, WebSocket phải đóng, không còn âm thanh phát. → Task 4 bước kiểm tra thủ công khi unmount.
4. **Bấm micro hai lần liên tiếp** — token chỉ dùng được 1 lần; phải chỉ có một phiên. → Task 4: `start()` không làm gì khi trạng thái khác `idle`/`error`; bước kiểm tra thủ công.
5. **Mở lại `/tin-dang?tro_ly=1` khi khoá bàn giao đã mất hoặc hỏng** — trang mở như thường, không lỗi. → Task 3 test `takeHandoff` với khoá thiếu và JSON hỏng.

---

### Task 1: Bài thử khả thi (cổng quyết định — mã bỏ đi) — ĐÃ ĐẠT, xem spec mục 11

**Files:**
- Create (KHÔNG commit, đặt trong thư mục scratchpad của phiên): `spike-kigi/index.html`

**Interfaces:** không có — chỉ trả lời câu hỏi "Gemini Live có đủ tốt cho tiếng Việt không".

- [ ] **Step 1: Dựng trang thử.** Một tệp HTML nạp `@google/genai@2.30.0` qua `https://esm.sh`, dùng khoá thật đặt trong mã (chỉ chạy `localhost`, không commit), kết nối `gemini-3.8-live` với lời dặn ở spec 4.4, hai công cụ `cap_nhat_nhu_cau(mo_ta: string)` và `mo_ket_qua()`. Công cụ giả trả kết quả cố định dạng spec 4.2. Thu micro 16 kHz PCM, phát 24 kHz. In ra màn hình: bản ghi chữ hai chiều, mỗi lời gọi công cụ (tên + tham số), độ trễ (mốc `inputTranscription` cuối → gói âm thanh trả về đầu tiên).
- [ ] **Step 2: Chạy** `npx serve spike-kigi -l 5500`, mở `http://localhost:5500`.
- [ ] **Step 3: Nghe thử giọng.** Lần lượt các giọng `Leda`, `Aoede`, `Kore`, `Puck`; chọn một giọng tiếng Việt tự nhiên, đúng dấu.
- [ ] **Step 4: Đo bốn tiêu chí** với 10 câu lấy từ `kgs-api/eval/assistant/cases.json` (các ca 1, 2, 4, 8, 9, 14, 16, 23, 31, 39). Ghi bảng kết quả:

| Tiêu chí | Ngưỡng đạt |
|---|---|
| Giọng tiếng Việt | Tự nhiên, đúng dấu, không lẫn tiếng Anh |
| Bản ghi chữ đúng ý | ≥ 8/10 |
| Độ trễ ngừng nói → bắt đầu trả lời | khoảng ≤ 1,5 giây |
| Gọi công cụ đúng lúc, đúng tham số; mô hình **chờ** kết quả công cụ rồi mới nói số căn | ≥ 9/10 |

  Nếu mô hình nói trước khi có kết quả công cụ: thử lại với khai báo hàm không đặt `behavior` và phản hồi công cụ có `scheduling: INTERRUPT`; ghi cấu hình nào đạt.
- [ ] **Step 5: Quyết định.** Đạt cả bốn → ghi giọng đã chọn + cấu hình công cụ đạt vào cuối spec (mục "Kết quả bài thử") và commit spec. Không đạt → **dừng, báo người dùng**, không làm các task sau.

```bash
git add docs/superpowers/specs/2026-10-18-tro-ly-giong-noi-design.md
git commit -m "docs(spec): kết quả bài thử Gemini Live tiếng Việt"
```

---

### Task 2: Endpoint cấp phiên giọng nói (.NET)

**Files:**
- Create: `kgs-api/kgs-api/Services/Voice/GeminiSettings.cs`, `kgs-api/kgs-api/Services/Voice/KiGiPrompt.cs`, `kgs-api/kgs-api/Services/Voice/VoiceSessionService.cs`, `kgs-api/kgs-api/Controllers/VoiceController.cs`
- Modify: `kgs-api/kgs-api/Extensions/ApplicationServiceExtensions.cs` (đăng ký), `kgs-api/kgs-api/Extensions/RateLimitingExtensions.cs` (chính sách `voice`), `kgs-api/kgs-api/appsettings.json` (mục `Gemini`), `kgs-api/kgs-api/appsettings.Development.json` (khoá thật — gitignored)
- Test: `kgs-api/kgs-api.Tests/VoiceSessionTests.cs`

**Interfaces:**
- Produces:
  - `GET /api/voice/status` → `200 { "enabled": bool }` (enabled = có `Gemini:ApiKey`). Không rate limit, không gọi Google.
  - `POST /api/voice/session` → `200 { "token": string, "model": string, "expiresAt": string(ISO) }` | `503 { "message": "Trợ lý giọng nói hiện chưa sẵn sàng." }` | `429` (chính sách `voice`).
  - `public sealed class GeminiSettings { string ApiKey = ""; string LiveModel = "gemini-3.8-live"; string Voice = "Kore"; int SessionMinutes = 3; }`
  - `public sealed record VoiceSessionResult(string Token, string Model, DateTimeOffset ExpiresAt);`
  - `VoiceSessionService(HttpClient http, IOptions<GeminiSettings> o, TimeProvider clock, ILogger<VoiceSessionService> log)`; `bool Enabled { get; }`; `Task<VoiceSessionResult?> CreateAsync(CancellationToken ct)` — null khi thiếu khoá hoặc Gemini lỗi; `internal static JsonObject BuildTokenRequest(GeminiSettings s, DateTimeOffset now)`.
  - `KiGiPrompt.SystemInstruction` (string, nguyên văn ràng buộc spec 4.4 — kể cả câu đệm và "giữ nguyên con số" — + vai KiGi 4.1 + luồng 4.3; câu "Khi được báo bắt đầu, chào thật ngắn và hỏi thuê hay mua, ở khu nào") và `KiGiPrompt.Tools` (khai báo hai hàm: `cap_nhat_nhu_cau` với tham số bắt buộc `mo_ta: STRING`, mô tả "Lời người dùng vừa nói, tóm thành một câu tiếng Việt"; `mo_ket_qua` không tham số).

- [ ] **Step 1: Viết test thất bại** trong `VoiceSessionTests.cs` (dùng `CapturingHandler : HttpMessageHandler` ghi lại request, theo mẫu `ValuationCircuitTests`; `FakeTimeProvider` tự viết hoặc `TimeProvider` cố định 2026-10-18T10:00:00Z):

```csharp
[Fact] public async Task ThieuKhoa_TraNull_KhongGoiGoogle()      // ApiKey "" → null, handler.Calls == 0, Enabled == false
[Fact] public async Task YeuCauToken_DungRangBuoc()
// body: uses == 1; expireTime == "2026-10-18T10:04:00Z"; newSessionExpireTime == "2026-10-18T10:01:00Z";
// bidiGenerateContentSetup.model == "models/gemini-3.8-live";
// setup.generationConfig.responseModalities == ["AUDIO"]; setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName == "Kore";
// setup.inputAudioTranscription và outputAudioTranscription tồn tại;
// setup.realtimeInputConfig.automaticActivityDetection.disabled == true;
// setup.systemInstruction.parts[0].text chứa "KiGi" và "giữ nguyên"; tên hàm trong tools == ["cap_nhat_nhu_cau","mo_ket_qua"];
// fieldMask liệt kê đủ: model, generationConfig.responseModalities, generationConfig.speechConfig, systemInstruction.parts, systemInstruction.role, tools, inputAudioTranscription, outputAudioTranscription, realtimeInputConfig
// request đi tới "/v1beta/auth_tokens" với header "x-goog-api-key" == khoá
[Fact] public async Task GoogleTra500_TraNull()
[Fact] public async Task TraTokenTuTruongName()                  // phản hồi {"name":"auth_tokens/abc"} → Token == "auth_tokens/abc", Model == "gemini-3.8-live", ExpiresAt == 10:04Z
```

- [ ] **Step 2: Chạy test, xác nhận thất bại.** `dotnet test kgs-api/kgs-api.Tests -c Release --filter VoiceSessionTests` → lỗi biên dịch (chưa có lớp).
- [ ] **Step 3: Cài đặt** `GeminiSettings`, `KiGiPrompt`, `VoiceSessionService` theo Interfaces. `HttpClient` có `BaseAddress = https://generativelanguage.googleapis.com/`, timeout 10 giây. Lỗi mạng/không 2xx → log cảnh báo, trả null (không ném).
- [ ] **Step 4: Chạy test** → 4 test PASS; chạy toàn bộ `dotnet test kgs-api/kgs-api.Tests -c Release` → không test cũ nào hỏng.
- [ ] **Step 5: Controller + đăng ký.** `VoiceController` `[ApiController][AllowAnonymous][Route("api/voice")]`: `GET status`, `POST session` gắn `[EnableRateLimiting(RateLimitingExtensions.Voice)]`. Thêm `public const string Voice = "voice";` và `options.AddPolicy(Voice, PartitionByUserOrIp(limit: 5, minutes: 10));`. Đăng ký `services.Configure<GeminiSettings>(config.GetSection("Gemini"))`, `services.AddHttpClient<VoiceSessionService>(…)`, `services.TryAddSingleton(TimeProvider.System)`. Thêm mục `Gemini` vào `appsettings.json` (khoá rỗng) và khoá thật vào `appsettings.Development.json`.
- [ ] **Step 6: Kiểm tra thật.** Chạy API, `curl -k https://localhost:7129/api/voice/status` → `{"enabled":true}`; `curl -k -X POST https://localhost:7129/api/voice/session` → 200 có `token` bắt đầu `auth_tokens/`; gọi lần thứ 6 trong 10 phút → 429.
- [ ] **Step 7: Commit** (sau khi quét khoá rỗng).

```bash
git add kgs-api/kgs-api/Services/Voice kgs-api/kgs-api/Controllers/VoiceController.cs kgs-api/kgs-api/Extensions kgs-api/kgs-api/appsettings.json kgs-api/kgs-api.Tests/VoiceSessionTests.cs
git commit -m "feat(giong-noi): endpoint cấp phiên Gemini Live bằng token tạm"
```

---

### Task 3: Công cụ của KiGi và bàn giao — hàm thuần + Vitest

**Files:**
- Modify: `quanly-tai-san/package.json` (devDependency `vitest@5.0.5`, script `"test": "vitest run"`), thêm `quanly-tai-san/vitest.config.ts` (alias `@` → `src`, môi trường `node`)
- Create: `quanly-tai-san/src/lib/voice/kigiTools.ts`, `quanly-tai-san/src/lib/voice/handoff.ts`
- Test: `quanly-tai-san/src/lib/voice/kigiTools.test.ts`, `quanly-tai-san/src/lib/voice/handoff.test.ts`

**Interfaces:**
- Consumes: `AssistantResult`, `assistantApi.searchIntent(message, previous)` (`lib/api/assistant.ts`); `listingsApi.search(f)` → `PagedResult` với `totalCount` (`lib/api/listings.ts`, `lib/api/http.ts`); `describeDemand(c)` (`lib/demandSummary.ts`); `SavedSearchCriteria`, `PublicListingFilters`.
- Produces:

```ts
export type MissingKey = "thuê hay mua" | "khu vực" | "ngân sách" | "loại nhà";
export function missingInfo(c: SavedSearchCriteria): MissingKey[];
export function criteriaToFilters(c: SavedSearchCriteria): PublicListingFilters; // null → bỏ trường, pageSize: 1
export function relaxCandidates(c: SavedSearchCriteria): { bo: string; criteria: SavedSearchCriteria }[];
export interface KiGiToolPayload {
  dieu_kien_da_hieu: string[]; chua_loc_duoc: string[]; so_can: number; uoc_tinh: boolean;
  con_thieu: MissingKey[]; goi_y_noi: { bo: string; so_can: number } | null;
}
export function buildToolPayload(r: AssistantResult, soCan: number,
  goiY: { bo: string; so_can: number } | null): KiGiToolPayload;
export interface KiGiDeps {
  searchIntent: (moTa: string, previous: AssistantResult | null) => Promise<AssistantResult>;
  count: (f: PublicListingFilters) => Promise<number>;
}
export function runCapNhatNhuCau(moTa: string, previous: AssistantResult | null, deps: KiGiDeps):
  Promise<{ result: AssistantResult; payload: KiGiToolPayload } | { loi: string }>;
// handoff.ts
export const HANDOFF_KEY = "kgs:tro-ly-ban-giao";
export function saveHandoff(r: AssistantResult, storage?: Storage): void;
export function takeHandoff(storage?: Storage): AssistantResult | null; // đọc rồi xoá
```

Quy tắc chốt:
- `missingInfo`: thiếu "thuê hay mua" khi `type` không phải 1/2; "khu vực" khi không có `city`, `district`, `newProvinceCode`, `newWardCode`, `latitude`; "ngân sách" khi không có `priceMin`, `priceMax`, `totalCostMax`; "loại nhà" khi `propertyTypes` rỗng. Trả theo đúng thứ tự trên.
- `relaxCandidates` theo thứ tự: bỏ `priceMax`/`totalCostMax` (nhãn lấy từ `describeDemand` của phần bị bỏ, ví dụ "≤ 4 triệu"), bỏ `propertyTypes`, bỏ `amenities`. Chỉ trả những điều kiện đang có.
- `buildToolPayload`: `dieu_kien_da_hieu = describeDemand(r.criteria)` nối thêm `r.preferences`; `uoc_tinh = r.anchor?.travelMinutes != null`.
- `runCapNhatNhuCau`: gọi `searchIntent(moTa, previous)` → đếm → nếu 0 thì thử lần lượt `relaxCandidates`, lấy ứng viên đầu tiên có số căn > 0 làm `goi_y_noi`. Bất kỳ lỗi nào → `{ loi: "Chưa xử lý được câu này" }`.

- [ ] **Step 1: Cài Vitest** và cấu hình; `npm test` chạy được (0 test).
- [ ] **Step 2: Viết test thất bại** — `kigiTools.test.ts`:

```ts
test("missingInfo theo đúng thứ tự ưu tiên", () =>
  expect(missingInfo({})).toEqual(["thuê hay mua", "khu vực", "ngân sách", "loại nhà"]));
test("đủ thuê + quận + giá thì chỉ còn loại nhà", () =>
  expect(missingInfo({ type: 2, district: "Quận Bình Thạnh", priceMax: 4_000_000 })).toEqual(["loại nhà"]));
test("totalCostMax cũng tính là ngân sách", () =>
  expect(missingInfo({ type: 2, city: "TP. Hồ Chí Minh", totalCostMax: 5e6, propertyTypes: [1] })).toEqual([]));
test("criteriaToFilters bỏ null và đặt pageSize 1", () =>
  expect(criteriaToFilters({ type: 2, district: null, priceMax: 4e6 })).toEqual({ type: 2, priceMax: 4e6, pageSize: 1 }));
test("cộng dồn: lượt hai gửi kết quả lượt một làm previous", async () => { /* deps giả ghi lại previous; lượt 2 nhận đúng object lượt 1 */ });
test("0 căn → gợi ý nới đầu tiên có căn", async () => {
  /* count: criteria có priceMax → 0; không priceMax → 9 ⇒ payload.so_can 0, goi_y_noi { bo: "≤ 4 triệu", so_can: 9 } */ });
test("có điểm neo thời gian đi lại → uoc_tinh true", () => { /* anchor.travelMinutes 20 ⇒ true; null ⇒ false */ });
test("searchIntent lỗi (vd 429) → { loi }", async () => { /* deps.searchIntent reject ⇒ { loi: "Chưa xử lý được câu này" } */ });
```

`handoff.test.ts` (Storage giả bằng `Map`):

```ts
test("save rồi take trả đúng kết quả và xoá khoá", …);
test("take khi không có khoá → null", …);
test("take khi JSON hỏng → null, không ném, xoá khoá", …);
```

- [ ] **Step 3: Chạy** `npm test` → các test FAIL (chưa có hàm).
- [ ] **Step 4: Cài đặt** `kigiTools.ts`, `handoff.ts` theo Interfaces và quy tắc chốt. `storage` mặc định `globalThis.sessionStorage`; mọi truy cập bọc `try/catch`.
- [ ] **Step 5: Chạy** `npm test` → tất cả PASS; `npx tsc --noEmit` sạch; `npx eslint src/lib/voice`.
- [ ] **Step 6: Commit.**

```bash
git add quanly-tai-san/package.json quanly-tai-san/package-lock.json quanly-tai-san/vitest.config.ts quanly-tai-san/src/lib/voice
git commit -m "feat(giong-noi): công cụ của KiGi, bàn giao bộ lọc, bộ test Vitest đầu tiên"
```

---

### Task 4: Hook `useGeminiLive` — kết nối, micro, loa, trạng thái

**Files:**
- Modify: `quanly-tai-san/package.json` (dependency `@google/genai@2.30.0`)
- Create: `quanly-tai-san/src/lib/api/voice.ts`, `quanly-tai-san/src/lib/voice/pcm.ts`, `quanly-tai-san/src/lib/voice/useGeminiLive.ts`, `quanly-tai-san/public/voice/mic-worklet.js`
- Test: `quanly-tai-san/src/lib/voice/pcm.test.ts`

**Interfaces:**
- Consumes: `POST /api/voice/session`, `GET /api/voice/status` (Task 2).
- Produces:

```ts
// lib/api/voice.ts
export const voiceApi = {
  status: () => api<{ enabled: boolean }>("/voice/status", { skipAuth: true }),
  session: () => api<{ token: string; model: string; expiresAt: string }>("/voice/session", { method: "POST", skipAuth: true }),
};
// lib/voice/pcm.ts
export function floatToPcm16Base64(samples: Float32Array): string;     // kẹp [-1,1], little-endian
export function pcm16Base64ToFloat(b64: string): Float32Array;
export function rms(samples: Float32Array): number;                   // 0..1
// lib/voice/useGeminiLive.ts
export type VoiceState = "idle" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";
export type VoiceError = "mic-denied" | "unavailable" | "quota" | "network";
export interface UseGeminiLiveOptions {
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  maxSeconds?: number;      // mặc định 180
  silenceSeconds?: number;  // mặc định 20
}
export function useGeminiLive(o: UseGeminiLiveOptions): {
  state: VoiceState; error: VoiceError | null;
  userText: string; agentText: string;   // bản ghi chữ lượt gần nhất
  level: number;                         // 0..1: âm lượng micro khi listening, âm lượng phát khi speaking
  start: () => Promise<void>;            // mở phiên; KiGi chào; sau đó state = "ready"
  talk: () => void;                      // chạm micro: mở lượt (ngắt KiGi nếu đang nói) / đang nghe thì kết thúc lượt
  stop: () => void;
};
```

Quy tắc chốt:
- `start()` chỉ chạy khi `state` là `idle` hoặc `error` (chống bấm hai lần). Thứ tự: xin micro (`getUserMedia`, từ chối → `error = "mic-denied"`) → `voiceApi.session()` (503 → `"unavailable"`, 429 → `"quota"`) → `new GoogleGenAI({ apiKey: token })` → `ai.live.connect({ model, callbacks })`. Cấu hình phiên đã khoá trong token, không gửi lại từ trình duyệt.
- Sau khi kết nối: `session.sendClientContent({ turns: "(Bắt đầu phiên.)", turnComplete: true })` để KiGi chào.
- Micro: `AudioContext({ sampleRate: 16000 })` + worklet `mic-worklet.js` gửi khung Float32. **Chỉ trong lượt nói** mới gửi: `talk()` → `sendRealtimeInput({ activityStart: {} })` → mỗi khung `sendRealtimeInput({ audio: { data: floatToPcm16Base64(f), mimeType: "audio/pcm;rate=16000" } })` → kết thúc lượt bằng `sendRealtimeInput({ activityEnd: {} })`.
- Kết thúc lượt: `rms(khung) > 0,02` đánh dấu đã có tiếng nói; sau đó 1,2 giây liền `rms ≤ 0,02` → kết thúc; hoặc `talk()` lần nữa; hoặc lượt đủ 15 giây. Ngưỡng `0,02` là hằng số `SPEECH_RMS` trong `pcm.ts`.
- `talk()` khi `speaking` → dừng mọi đoạn đang phát, xoá hàng đợi, rồi mở lượt mới.
- Loa: `AudioContext({ sampleRate: 24000 })`, xếp hàng các đoạn `pcm16Base64ToFloat` liền nhau; khi có `serverContent.interrupted` thì dừng mọi đoạn đang phát và xoá hàng đợi.
- Trạng thái: đang trong lượt nói → `listening`; có âm thanh đang phát → `speaking`; đang chờ `onToolCall` → `thinking`; còn lại khi đã kết nối → `ready`.
- `toolCall.functionCalls` → gọi `onToolCall(fc.name, fc.args)` tuần tự → `session.sendToolResponse({ functionResponses: [{ id, name, response }] })` (thêm `scheduling` nếu Task 1 ghi là cần).
- Hết `maxSeconds` → `stop()`. Ở `ready` liền `silenceSeconds` → gửi `session.sendClientContent({ turns: "(Người dùng im lặng. Hãy chào tạm biệt thật ngắn.)", turnComplete: true })`, đóng phiên khi nhận `turnComplete` kế tiếp.
- `onclose`/`onerror` ngoài ý muốn → `state = "error"`, `error = "network"`.
- Unmount → `stop()`: dừng track micro, đóng hai `AudioContext`, đóng session.

- [ ] **Step 1: Viết test thất bại** `pcm.test.ts`:

```ts
test("khứ hồi float → pcm16 → float sai số < 1/32768", …);
test("kẹp mẫu ngoài [-1, 1]", () => expect(pcm16Base64ToFloat(floatToPcm16Base64(new Float32Array([2, -2])))).toEqual(new Float32Array([32767/32768, -1])));
test("rms của im lặng là 0, của sóng biên độ 1 là ≈ 0,707", …);
```

- [ ] **Step 2: Chạy** `npm test -- pcm` → FAIL.
- [ ] **Step 3: Cài đặt** `pcm.ts`, `voice.ts`, `mic-worklet.js` (một `AudioWorkletProcessor` gửi `inputs[0][0]` qua `port.postMessage`), `useGeminiLive.ts` theo quy tắc chốt.
- [ ] **Step 4: Chạy** `npm test` → PASS; `npx tsc --noEmit` và `npx eslint src/lib` sạch.
- [ ] **Step 5: Kiểm tra thủ công** với một nút tạm trên trang `/dev` (xoá ở Task 6): bắt đầu → nghe KiGi chào; chạm micro, nói "thuê phòng trọ Bình Thạnh", im lặng → lượt tự kết thúc, nghe "Để mình xem nhé" rồi câu trả lời; chạm micro khi KiGi đang nói → KiGi dừng ngay; bấm bắt đầu hai lần liên tiếp → chỉ một phiên (Network: một lần `POST /api/voice/session`); điều hướng sang trang khác giữa phiên → đèn micro tắt, không còn tiếng.
- [ ] **Step 6: Commit.**

```bash
git add quanly-tai-san/package.json quanly-tai-san/package-lock.json quanly-tai-san/public/voice quanly-tai-san/src/lib/api/voice.ts quanly-tai-san/src/lib/voice/pcm.ts quanly-tai-san/src/lib/voice/pcm.test.ts quanly-tai-san/src/lib/voice/useGeminiLive.ts
git commit -m "feat(giong-noi): hook Gemini Live — micro, loa, trạng thái, công cụ"
```

---

### Task 5: Mascot KiGi (SVG)

**Files:**
- Create: `quanly-tai-san/src/components/voice/KiGiMascot.tsx`

**Interfaces:**
- Consumes: `VoiceState` (Task 4).
- Produces: `export function KiGiMascot(props: { state: VoiceState; level: number; size?: number }): JSX.Element` (mặc định `size` 160).

Quy tắc chốt: ngôi nhà nhỏ có mái, hai mắt, miệng; màu theo token thương hiệu hiện có (`--primary`). Sáu trạng thái:
- `idle` và `ready`: thở nhẹ (scale 1 → 1,02, 3 giây); `ready` thêm micro nhỏ nhấp nháy gợi ý "chạm để nói";
- `connecting`: mắt nhìn quanh;
- `listening`: vòng sóng quanh mascot, bán kính theo `level`;
- `thinking`: mắt nhìn lên, ba chấm;
- `speaking`: chiều cao miệng = 2 + `level` × 14 px;
- `error`: miệng cong xuống.

Hoạt ảnh bằng CSS keyframes trong SVG; `@media (prefers-reduced-motion: reduce)` tắt mọi keyframes (miệng vẫn theo `level`). `role="img"`, `aria-label` theo trạng thái ("KiGi đang nghe"…).

- [ ] **Step 1: Cài đặt** `KiGiMascot.tsx`.
- [ ] **Step 2: Kiểm tra trực quan** trên trang `/dev` tạm: hiện đủ 6 trạng thái cạnh nhau, thanh trượt `level`; chụp màn hình sáng/tối và khi bật "giảm chuyển động".
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint src/components/voice` sạch.
- [ ] **Step 4: Commit.**

```bash
git add quanly-tai-san/src/components/voice/KiGiMascot.tsx
git commit -m "feat(giong-noi): mascot KiGi 2D với sáu trạng thái"
```

---

### Task 6: Ghép vào Trang chủ và bàn giao sang trang Tìm nhà

**Files:**
- Create: `quanly-tai-san/src/components/voice/VoiceAssistant.tsx`
- Modify: `quanly-tai-san/src/routes/index.tsx` (`Hero`, tab `"ai"`), `quanly-tai-san/src/routes/tin-dang.index.tsx` (`ListingsSearchParams`, `validateSearch`, khối áp tham số URL lúc mở trang)
- Delete: trang `/dev` tạm của Task 4–5

**Interfaces:**
- Consumes: `useGeminiLive`, `KiGiMascot`, `runCapNhatNhuCau`, `buildToolPayload`, `saveHandoff`/`takeHandoff`, `describeDemand`, `voiceApi.status`.
- Produces: `export function VoiceAssistant(): JSX.Element | null`; tham số URL `tro_ly?: 1` của `/tin-dang`.

Quy tắc chốt:
- `VoiceAssistant` trả `null` khi `voiceApi.status()` lỗi hoặc `enabled = false`, hoặc thiếu `navigator.mediaDevices`, `window.isSecureContext`, `AudioWorkletNode`.
- Giao diện:
  - Nút "Nói với KiGi" cạnh ô gõ hiện có, dưới nút là dòng "Giọng nói được xử lý bởi Google Gemini". Trong phiên, nút micro lớn gọi `talk()`, nhãn theo trạng thái ("Chạm để nói" / "Đang nghe… chạm để gửi" / "Chạm để ngắt lời").
  - Khi đang có phiên, hiện khung gồm `KiGiMascot`, hai dòng bản ghi chữ (`userText`, `agentText`), hàng thẻ `dieu_kien_da_hieu` và nút "Xem N căn" (N = `so_can`, có tiền tố "khoảng" khi `uoc_tinh`).
- `onToolCall`:
  - `cap_nhat_nhu_cau` → `runCapNhatNhuCau(args.mo_ta, ketQuaGanNhat, { searchIntent: assistantApi.searchIntent, count: f => listingsApi.search(f).then(p => p.totalCount) })`, lưu `result` làm `ketQuaGanNhat`, trả `payload` (hoặc `{ loi }`).
  - `mo_ket_qua` → `saveHandoff(ketQuaGanNhat)`, `stop()`, `navigate({ to: "/tin-dang", search: { tro_ly: 1 } })`, trả `{ ok: true }`.
  - Nút "Xem N căn" làm đúng việc của `mo_ket_qua`.
- Lỗi:
  - `mic-denied` → toast "Bạn có thể gõ nhu cầu vào ô bên cạnh" và focus ô gõ.
  - `unavailable` / `quota` / `network` → mascot `error`, dòng "Trợ lý giọng nói đang bận"; **giữ thẻ và nút "Xem N căn"** nếu đã có kết quả.
- `/tin-dang`: `validateSearch` thêm `tro_ly: s.tro_ly === 1 || s.tro_ly === "1" ? 1 : undefined`. Trong khối áp URL lúc mở trang: nếu `u.tro_ly`, gọi `takeHandoff()`; có kết quả thì `applyAssistant(r)` (hàm sẵn có của trang, cùng đường với `q`); không có thì bỏ qua.

- [ ] **Step 1: Cài đặt** `VoiceAssistant.tsx`, gắn vào `Hero`, sửa `/tin-dang`, xoá trang `/dev`.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npx eslint src` (chỉ lỗi cũ đã biết ở `PriceSuggestion.tsx`, `analytics.ts` được phép còn), `npx prettier --check` các tệp đã sửa.
- [ ] **Step 3: Kiểm tra trên trình duyệt** (`preview_start` web + API dev):
  - Có khoá → nút micro hiện.
  - Xoá khoá trong cấu hình rồi khởi động lại API → `GET /api/voice/status` trả `enabled:false` → nút micro biến mất, ô gõ tay vẫn chạy.
  - Mở `/tin-dang?tro_ly=1` khi không có khoá bàn giao → trang mở bình thường, không lỗi console.
- [ ] **Step 4: Commit.**

```bash
git add quanly-tai-san/src/components/voice/VoiceAssistant.tsx quanly-tai-san/src/routes/index.tsx quanly-tai-san/src/routes/tin-dang.index.tsx
git commit -m "feat(giong-noi): KiGi trên Trang chủ, bàn giao bộ lọc sang trang Tìm nhà"
```

---

### Task 7: Kiểm thử theo kịch bản, video dự phòng, cập nhật báo cáo

**Files:**
- Modify: `kgs-api/kgs-api/appsettings.Development.json` (chỉ máy dev: `"RateLimits": { "Assistant": 200 }` khi tập demo — gitignored)
- Modify: báo cáo trình bày (Claude Docs `6d6a99d3-…`): thêm mục "Trợ lý giọng nói KiGi"

- [ ] **Step 1: Chạy màn demo spec 4.5** trên `localhost` bằng giọng thật, ghi lại: số lượt, các thẻ xuất hiện sau mỗi lượt, trang Tìm nhà cuối cùng có đúng điều kiện (kể cả tiện nghi "cho nuôi thú cưng" — thứ URL thường không chở được).
- [ ] **Step 2: Chạy kịch bản lỗi:**
  - Từ chối micro.
  - Tắt mạng giữa phiên: thẻ còn, nút "Xem N căn" vẫn dùng được.
  - Im lặng 20 giây: KiGi chào rồi đóng.
  - Phiên chạm 3 phút.
  - Nói một nhu cầu cho ra 0 căn: KiGi đọc gợi ý nới có số thật.
  - Nói một điều chưa lọc được: KiGi nói thẳng.
  - Chụp màn hình từng kịch bản.
- [ ] **Step 3: Quay video** màn demo (khoảng 1 phút) làm dự phòng; lưu ngoài repo.
- [ ] **Step 4: Cập nhật báo cáo trình bày:**
  - Mục "Trợ lý giọng nói KiGi" gồm kiến trúc (sơ đồ), luồng một phiên, ràng buộc an toàn, kết quả bài thử (Task 1).
  - Thêm câu hỏi giảng viên có thể hỏi: vì sao Gemini Live, vì sao bộ lọc vẫn qua Groq, quyền riêng tư.
- [ ] **Step 5:** Toàn bộ `dotnet test kgs-api/kgs-api.Tests -c Release` và `npm test` PASS; quét khoá rỗng; đẩy nhánh `feat/tro-ly-giong-noi`, gửi người dùng liên kết tạo PR.

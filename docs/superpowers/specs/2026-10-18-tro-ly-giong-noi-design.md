# Trợ lý giọng nói KiGi trên Trang chủ — Thiết kế

Ngày: 18/10/2026 · Trạng thái: chờ duyệt

## 1. Mục tiêu và phạm vi

**Mục tiêu:** ở ô "Tìm nhà bằng một câu" trên Trang chủ, thêm một lối vào bằng **giọng nói**:
mascot 2D tên **KiGi** trò chuyện với người dùng, hỏi bù điều còn thiếu, và dựng bộ lọc tìm
kiếm trực tiếp trên màn hình. Ưu tiên số một là **một màn demo ấn tượng, chạy ổn định khi bảo
vệ đồ án**; người dùng thật là thứ yếu.

**Tiêu chí thành công:**

1. Màn demo ở mục 4.5 chạy trọn vẹn: 2–3 lượt nói, bộ lọc hiện dần trên màn hình, kết thúc ở
   trang Tìm nhà với đúng các điều kiện đã nói.
2. Mọi điều kiện lọc đều đi qua pipeline trợ lý hiện có (`POST /api/assistant/search-intent`,
   đã đánh giá khớp hoàn toàn 91%, precision 98%) — mô hình giọng nói không tự trích bộ lọc.
3. Khi giọng nói hỏng ở bất kỳ khâu nào, Trang chủ vẫn dùng được như hiện nay.
4. Không phát sinh chi phí: chỉ dùng gói miễn phí của Gemini API.

**Trong phạm vi:** Trang chủ (`routes/index.tsx`, khu Hero, tab "ai"), một endpoint .NET mới,
một hook kết nối Gemini Live, một component mascot, hai công cụ cho mô hình.

**Ngoài phạm vi (cố ý):** giọng nói ở trang khác; đăng tin bằng giọng nói; lưu lịch sử hội
thoại; giọng đọc dự phòng khi Gemini hỏng (đường lui là ô gõ tay); mascot 3D.

## 2. Nền tảng: Gemini Live API

Đã so sánh ba hướng: Gemini Live, nền tảng trọn gói (Vapi / ElevenLabs Agents), tự lắp trên
trình duyệt (Web Speech API + Groq + giọng đọc trình duyệt). Chọn **Gemini Live** vì:

- Miễn phí ở gói free (`gemini-3.8-live`, `gemini-3.1-flash-live-preview`).
- Mô hình nghe–nói trực tiếp (không qua bước chuyển giọng nói ↔ chữ riêng), có tiếng Việt
  (`vi`), gọi hàm, tự nhận biết lượt nói và cho phép ngắt lời, có bản ghi chữ hai chiều.
- Có token tạm (ephemeral token) để trình duyệt kết nối thẳng mà không lộ khoá.

Đã xác minh (18/10/2026): khoá của dự án gọi được API và có quyền vào `gemini-3.8-live` và
`gemini-3.1-flash-live-preview`.

**Mô hình:** chính `gemini-3.8-live`; dự phòng cấu hình được `gemini-3.1-flash-live-preview`
(đổi qua cấu hình, không đổi mã).

**Cổng quyết định:** chất lượng tiếng Việt của mô hình nghe–nói chưa được kiểm chứng cho bài
toán này. Bước đầu tiên của triển khai là bài thử khả thi ở mục 8; không đạt thì dừng và cân
nhắc lại hướng Vapi.

## 3. Kiến trúc

```
Trình duyệt (Trang chủ)                       .NET API                      Google
┌──────────────────────────────┐   1. xin phiên   ┌──────────────────┐  tạo token  ┌─────────────┐
│ VoiceAssistant               │ ───────────────► │ POST /api/voice/ │ ──────────► │ Gemini API  │
│  ├─ Mascot (SVG 2D)          │ ◄─ token tạm ─── │      session     │             │ (khoá ở máy │
│  ├─ useGeminiLive (mic/loa)  │                  └──────────────────┘             │  chủ)       │
│  └─ công cụ (2)              │ 2. âm thanh hai chiều (WebSocket, token tạm)       ├─────────────┤
│        │                     │ ◄════════════════════════════════════════════════► │ Gemini Live │
│        │ 3. khi Gemini gọi công cụ                                               └─────────────┘
│        └──► POST /api/assistant/search-intent  (pipeline Groq hiện có, không đổi)
│             GET  /api/listings/search          (đếm số căn khớp)
└──────────────────────────────┘
```

Lời gọi công cụ được thực thi **ở trình duyệt**: Gemini gửi yêu cầu gọi hàm qua kết nối Live,
trình duyệt gọi API KGS rồi gửi kết quả ngược lại. Máy chủ KGS không phải giữ kết nối WebSocket.

### 3.1 Các thành phần

| Thành phần | Vị trí | Việc duy nhất | Phụ thuộc |
|---|---|---|---|
| `VoiceSessionController` + `VoiceSessionService` | `kgs-api/Controllers`, `kgs-api/Services/Voice` | Dùng khoá Gemini để xin token tạm, khoá cứng mô hình, lời dặn hệ thống, công cụ, giọng đọc | `HttpClient` tới Gemini API, cấu hình `Gemini` |
| `useGeminiLive` | `quanly-tai-san/src/lib/voice/` | Kết nối Live bằng token tạm; thu micro (PCM 16 kHz), phát âm thanh trả về (PCM 24 kHz); quản lý trạng thái; chuyển lời gọi công cụ cho bộ xử lý; phát mức âm lượng đang phát | SDK `@google/genai` (phần Live), Web Audio API |
| `Mascot` | `quanly-tai-san/src/components/voice/` | Vẽ KiGi theo `trạng thái` và `âm lượng` | Không |
| Bộ xử lý công cụ + các hàm thuần | `quanly-tai-san/src/lib/voice/` | Thực thi `cap_nhat_nhu_cau`, `mo_ket_qua`; cộng dồn bộ lọc; tính "còn thiếu"; dựng kết quả trả cho Gemini | `assistantApi.searchIntent`, API tìm kiếm tin |
| `VoiceAssistant` | `quanly-tai-san/src/components/voice/` | Ghép mascot, bản ghi chữ, thẻ điều kiện, nút "Xem N căn" vào tab "ai" của Hero | Ba thành phần trên |

`useGeminiLive` không biết gì về bất động sản; `Mascot` không biết gì về kết nối. Mỗi phần thử
được độc lập.

### 3.2 Endpoint `POST /api/voice/session`

- `[AllowAnonymous]`, giới hạn **5 phiên / 10 phút / IP** (chính sách rate limit mới
  `voice`, trả 429 như các chính sách hiện có).
- Gọi API tạo token tạm của Gemini với: `uses = 1`; hết hạn khởi tạo phiên sau 1 phút; hết hạn
  phiên sau 4 phút (phiên dùng tối đa 3 phút, dư 1 phút); khoá cứng `model`, `systemInstruction`,
  `tools`, `speechConfig` (giọng đọc), bật `inputAudioTranscription` và `outputAudioTranscription`.
- Trả `{ token, model, expiresAt }`. Khoá thật không bao giờ rời máy chủ.
- Thiếu khoá trong cấu hình hoặc Gemini lỗi → **503** `{ message }`; giao diện ẩn nút micro.
- Lời dặn hệ thống và khai báo công cụ đặt ở phía máy chủ (một nguồn duy nhất), không gửi từ
  trình duyệt.

**Cấu hình** (`appsettings.json` có giá trị mặc định, khoá đặt trong
`appsettings.Development.json` đã gitignore — giống khoá Groq):

```json
"Gemini": {
  "ApiKey": "",
  "LiveModel": "gemini-3.8-live",
  "Voice": "Leda",
  "SessionMinutes": 3
}
```

`Voice` mặc định `Leda`; bài thử khả thi (mục 8) nghe thử các giọng của Gemini với tiếng Việt
và chốt giọng cuối cùng vào cấu hình.

## 4. Hội thoại

### 4.1 Nhân vật

KiGi — ngôi nhà nhỏ thân thiện của KGS, xưng "mình", gọi "bạn". Tên có thể đổi.

### 4.2 Hai công cụ

**`cap_nhat_nhu_cau(mo_ta: string)`** — Gemini gọi mỗi khi người dùng nói thêm điều kiện.
`mo_ta` là lời người dùng vừa nói, tóm thành một câu tiếng Việt. Trình duyệt:

1. Gọi `assistantApi.searchIntent(mo_ta, ketQuaTruoc)` — bộ lọc **cộng dồn** qua các lượt nhờ
   tham số `Current` / `CurrentPreferences` / `CurrentAnchor` sẵn có.
2. Đếm số căn khớp bằng API tìm kiếm tin (chỉ lấy tổng).
3. Nếu 0 căn: thử bỏ lần lượt từng điều kiện (giá tối đa, loại hình, tiện nghi) và đếm lại,
   chọn một gợi ý nới có số căn > 0 — **con số trong gợi ý là số đếm thật**.
4. Cập nhật thẻ điều kiện trên màn hình.
5. Trả cho Gemini:

```json
{
  "dieu_kien_da_hieu": ["Cho thuê", "Phòng trọ", "Bình Thạnh", "≤ 4 triệu"],
  "chua_loc_duoc": ["gần trường con"],
  "so_can": 3,
  "con_thieu": ["ngân sách"],
  "goi_y_noi": { "bo": "≤ 4 triệu", "so_can": 9 }
}
```

`con_thieu` tính bằng mã, theo thứ tự ưu tiên: **thuê hay mua → khu vực → ngân sách → loại
nhà**. Lỗi khi gọi API → trả `{ "loi": "Chưa xử lý được câu này" }` để KiGi xin nói lại.

**`mo_ket_qua()`** — Gemini gọi khi người dùng đồng ý xem. Trình duyệt kết thúc phiên rồi chuyển
tới `/tin-dang?tro_ly=1`.

**Bàn giao bộ lọc sang trang Tìm nhà.** Tham số URL hiện có (`type`, `city`, `district`,
`priceMin`, `priceMax`, `loai`…) không chở được tiện nghi, mong muốn mềm hay điểm neo đi lại.
Trang Tìm nhà đã có sẵn đoạn mã áp **nguyên một `AssistantResult`** (dùng cho tham số `q`). Vì
vậy: trước khi chuyển trang, kết quả trợ lý cuối cùng được ghi vào `sessionStorage`
(khoá `kgs:tro-ly-ban-giao`); trang Tìm nhà thấy `tro_ly=1` thì đọc, áp bằng **đúng đoạn mã áp
kết quả của `q`**, rồi xoá khoá. Không có khoá (mở lại liên kết sau đó) thì bỏ qua, trang mở như
thường. Đoạn mã áp được tách thành một hàm dùng chung cho cả hai lối vào.

### 4.3 Luồng một phiên

1. Người dùng bấm micro → xin quyền micro → gọi `/api/voice/session` → kết nối Live.
2. KiGi chào và hỏi: thuê hay mua, ở khu nào.
3. Mỗi lượt: người dùng nói → Gemini gọi `cap_nhat_nhu_cau` → thẻ trên màn hình đổi → KiGi nói
   lại điều vừa hiểu + số căn, rồi hỏi **một** điều trong `con_thieu`.
4. Thôi hỏi khi: đủ ba thông tin chính (thuê/mua, khu vực, ngân sách), **hoặc** đã hỏi 3 câu,
   **hoặc** người dùng muốn xem luôn → KiGi mời xem kết quả → người dùng đồng ý → `mo_ket_qua`.
5. Nút "Xem N căn" trên màn hình làm đúng việc của `mo_ket_qua` bất cứ lúc nào.

### 4.4 Lời dặn hệ thống (ràng buộc cứng)

- Chỉ nói tiếng Việt; mỗi lượt tối đa 2 câu.
- Mọi thay đổi điều kiện tìm kiếm phải đi qua `cap_nhat_nhu_cau`.
- **Không bao giờ tự nêu căn nhà, giá, địa chỉ cụ thể** ngoài số liệu công cụ trả về.
- Có `chua_loc_duoc` thì nói thẳng là chưa lọc được theo điều đó.
- `so_can = 0` thì đề xuất đúng gợi ý trong `goi_y_noi`.
- Không tư vấn pháp lý, tài chính; lạc đề thì trả lời một câu rồi quay về tìm nhà.

### 4.5 Màn demo chuẩn

> **KiGi:** Chào bạn, mình là KiGi! Bạn đang muốn thuê hay mua nhà, ở khu nào?
> **Người dùng:** Mình cần thuê phòng trọ ở Bình Thạnh, có chỗ để xe.
> *(thẻ: Cho thuê · Phòng trọ · Bình Thạnh · Chỗ để xe)*
> **KiGi:** Có 14 phòng trọ ở Bình Thạnh có chỗ để xe. Bạn dự tính khoảng bao nhiêu một tháng?
> **Người dùng:** Dưới 4 triệu thôi… à mà cho nuôi mèo nữa.
> *(thẻ: + ≤ 4 triệu · + Cho nuôi thú cưng)*
> **KiGi:** Còn 3 phòng hợp với bạn. Mình mở danh sách cho bạn xem nhé?
> **Người dùng:** Ừ. → *trang Tìm nhà với 3 phòng*

(Số căn thực tế phụ thuộc dữ liệu trình diễn lúc demo.)

## 5. Mascot

- SVG 2D: ngôi nhà nhỏ có mắt và miệng, màu theo nhận diện KGS.
- Sáu trạng thái: **chờ** (thở nhẹ), **đang kết nối**, **đang nghe** (vòng sóng quanh mascot
  theo âm lượng micro), **đang nghĩ** (khi đang chạy công cụ), **đang nói** (miệng nhúp theo
  âm lượng phát), **lỗi / buồn**.
- Hoạt ảnh bằng CSS/SVG, không thêm thư viện. Tôn trọng `prefers-reduced-motion`.
- Dưới mascot: bản ghi chữ hai dòng gần nhất (người dùng / KiGi) và hàng thẻ điều kiện.

## 6. Xử lý sự cố

| Tình huống | Xử lý | Người dùng thấy |
|---|---|---|
| Thiếu khoá / `/api/voice/session` lỗi | 503 | Không có nút micro; Trang chủ như cũ |
| Trình duyệt không có micro / WebSocket / ngữ cảnh an toàn | Kiểm tra trước | Nút micro ẩn |
| Từ chối quyền micro | Đóng phiên, không hỏi lại | Gợi ý gõ vào ô bên cạnh, con trỏ nhảy vào ô |
| Hết hạn mức (429), mất mạng, phiên hết hạn | Đóng phiên gọn, mascot "buồn" | "Trợ lý giọng nói đang bận"; **thẻ đã dựng được giữ lại**, nút "Xem N căn" vẫn dùng được |
| Công cụ gọi API lỗi | Trả `loi` cho Gemini | KiGi xin nói lại |
| Nghe nhầm | Bản ghi chữ của người dùng hiện ngay | Nói lại hoặc gỡ thẻ sai |
| Spam phiên | 5 phiên / 10 phút / IP; phiên tối đa 3 phút; im lặng 20 giây thì KiGi chào và đóng | Thông báo thử lại sau |

## 7. Riêng tư

- Âm thanh đi thẳng từ trình duyệt tới Google; KGS không lưu âm thanh hay bản ghi chữ.
- Gói free của Gemini có thể dùng dữ liệu để cải thiện sản phẩm → dưới nút micro luôn có dòng
  "Giọng nói được xử lý bởi Google Gemini". Bấm micro là đồng ý.
- Không gửi thông tin tài khoản, vị trí của người dùng cho Gemini.

## 8. Kiểm thử

**Bước 0 — Bài thử khả thi (cổng, mã bỏ đi sau khi thử).** Trang HTML tạm nói chuyện với
`gemini-3.8-live` bằng tiếng Việt, dùng đúng lời dặn và công cụ giả lập:

| Tiêu chí | Ngưỡng đạt |
|---|---|
| Giọng KiGi nói tiếng Việt | Tự nhiên, đúng dấu, không lẫn tiếng Anh (chọn giọng ở bước này) |
| Bản ghi chữ 10 câu mẫu lấy từ bộ đánh giá trợ lý (có "2tr5", "Gò Vấp", "sổ hồng") | ≥ 8/10 câu đúng ý |
| Độ trễ từ lúc ngừng nói tới lúc KiGi bắt đầu nói | Khoảng ≤ 1,5 giây |
| Gọi công cụ đúng lúc, đúng tham số | ≥ 9/10 lượt |

Không đạt → dừng, báo lại, cân nhắc hướng Vapi.

**Tự động:**

- Backend (xUnit): `/api/voice/session` trả 503 khi thiếu khoá; yêu cầu gửi tới Gemini mang
  đúng mô hình, thời hạn, `uses = 1`, công cụ và lời dặn; giới hạn phiên. Giả lập Gemini bằng
  `HttpMessageHandler` giả như test `ValuationService`.
- Frontend (Vitest — bộ test giao diện đầu tiên của dự án, chỉ cho hàm thuần): tính
  `con_thieu`; dựng kết quả công cụ; cộng dồn bộ lọc qua nhiều lượt; chọn gợi ý nới khi 0 căn.

**Thủ công có kịch bản:** chạy màn demo 4.5; từ chối micro; tắt mạng giữa phiên; xoá khoá
khỏi cấu hình; im lặng 20 giây. Chụp màn hình làm bằng chứng.

## 9. Thứ tự thực hiện

1. Bài thử khả thi (cổng).
2. `/api/voice/session` + cấu hình + test backend.
3. `useGeminiLive`: kết nối, micro, loa, trạng thái.
4. `Mascot` SVG với 6 trạng thái.
5. Hai công cụ + các hàm thuần + Vitest.
6. Ghép vào Hero Trang chủ, kèm dòng thông báo riêng tư; tách hàm áp `AssistantResult` dùng chung
   và cho trang Tìm nhà đọc bàn giao `tro_ly=1`.
7. Kiểm thử thủ công theo kịch bản; quay video màn demo làm dự phòng cho buổi bảo vệ.
8. Cập nhật báo cáo trình bày: mục "Trợ lý giọng nói KiGi" và luồng hoạt động.

## 10. Chuẩn bị cho buổi bảo vệ

- Chạy qua `localhost` (trình duyệt coi là ngữ cảnh an toàn nên cho dùng micro).
- Kiểm tra trước: khoá còn hạn mức, micro đã cấp quyền, dịch vụ API và Groq đang chạy.
- Có sẵn video màn demo để chiếu nếu mạng phòng bảo vệ chập chờn.

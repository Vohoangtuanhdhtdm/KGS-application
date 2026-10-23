# Ghép đôi hai chiều: "Đăng nhu cầu — chủ nhà sẽ mời bạn"

Ngày: 22/10/2026 · Nhánh: `feat/ghep-doi-nhu-cau`

## 1. Bối cảnh và vấn đề

Ghép đôi hai chiều đã chạy đúng ở phía máy chủ: người tìm bật "cho chủ nhà phù hợp mời tôi" trên một
bộ lọc đã lưu, chủ nhà thấy nhu cầu ẩn danh khớp tin của mình và gửi lời mời, người tìm nhận lời thì
thành yêu cầu xem nhà. Nhưng gần như không ai dùng, vì hai lý do đã kiểm chứng trong mã:

1. **Bị giấu.** Để bật, người tìm phải: đăng nhập → lưu bộ lọc → mở popover "Bộ lọc đã lưu" → tìm một
   biểu tượng bắt tay 14 px → bấm Bật. Trang chủ, trang kết quả, trợ lý AI, KiGi không nhắc gì tới
   chức năng. Phía chủ nhà chỉ có một huy hiệu ở "Tin của tôi", và huy hiệu chỉ hiện khi đã có người bật.
2. **Hai phía chờ nhau, kể cả trong dữ liệu trình diễn.** Bộ dữ liệu mẫu chỉ có 3 nhu cầu đang mở, ở 3
   quận khác nhau — không đủ để trình diễn bất cứ thứ gì.

Ràng buộc kỹ thuật phát hiện khi rà soát: so khớp nhu cầu với tin là **một truy vấn cho mỗi nhu cầu**
(tối đa 300). Mọi tính năng mới không được chạy so khớp hàng loạt trên đường người dùng phải chờ.

## 2. Mục tiêu

- Người tìm nhà **thấy** chức năng ở nơi họ đang cần và bật được trong **1–2 bấm**.
- Chủ nhà **thấy có cầu thật** và được báo đúng lúc để mời.
- Có một điểm sáng tạo rõ ràng: **lời mời kèm ưu đãi riêng**.
- Giữ nguyên quyền riêng tư: người tìm ẩn danh tới khi tự nhận lời.

Ngoài phạm vi: nhắn tin, đặt cọc, chủ nhà "đấu giá" lời mời, hồ sơ người thuê có xác minh.

## 3. Khái niệm và tên gọi

| Trước | Sau (giao diện) | Trong mã |
|---|---|---|
| Bộ lọc đã lưu + bật "cho chủ nhà mời" | **Nhu cầu tìm nhà** — "Đăng nhu cầu, chủ nhà sẽ mời bạn" | vẫn là `SavedSearch` với `DiscoverableByOwners = true` |
| Lời mời xem nhà | Lời mời xem nhà, có thể kèm **Ưu đãi riêng cho bạn** | `ListingInvitation` + `OfferPrice`, `OfferNote` |
| (không có) | **Nhịp cầu** — "28 người đang tìm thuê ở Bình Thạnh" | `DemandPulse` |

Một bộ lọc đã lưu chưa bật chế độ mở vẫn là bộ lọc đã lưu bình thường (nhận báo tin mới).

## 4. Trải nghiệm phía người tìm nhà (Đợt 1)

### 4.1 Hộp "Đăng nhu cầu"

Hộp thoại dùng chung `PostDemandDialog`, nhận sẵn bộ lọc hiện tại. Gồm:

- Tên nhu cầu (gợi ý sẵn từ bộ lọc, ví dụ "Phòng trọ Bình Thạnh dưới 5 triệu").
- **Số người ở** (1–20, tuỳ chọn) — trường mới của bộ lọc (mục 6.1).
- Hai thông tin đã có sẵn trong bộ lọc, hiển thị để người dùng điền/chỉnh: **dọn vào trước ngày**
  (`AvailableBy`) và **cần nuôi thú cưng** (`PetsAllowed`).
- Lời nhắn cho chủ nhà (tối đa 300 ký tự).
- Ô "Báo tôi khi có tin mới khớp" (bật sẵn).

Một nút **"Đăng nhu cầu"** gọi một API duy nhất (tạo bộ lọc với chế độ mở bật sẵn). Sau đó toast
"Đã đăng — chủ nhà phù hợp có thể mời bạn" kèm liên kết tới "Nhu cầu của tôi".

**Khách chưa đăng nhập:** bấm "Đăng nhu cầu" thì lưu bản nháp (bộ lọc + các ô đã nhập) vào
`sessionStorage`, chuyển tới `/login?redirect=<trang hiện tại>&postDemand=1`; quay lại trang thì
hộp tự mở với bản nháp đã điền.

### 4.2 Năm lối vào

| Nơi | Hiển thị |
|---|---|
| Trang chủ | Mục riêng "Không muốn tự lục tìm?" + nút Đăng nhu cầu + thẻ Nhịp cầu (các khu đang có nhiều người tìm) |
| Trang Tìm nhà — luôn có | Nút "Đăng nhu cầu" cạnh "Lưu bộ lọc" |
| Trang Tìm nhà — ít kết quả | Khi tổng số tin < 5: thẻ "Chưa có nhiều căn khớp — đăng nhu cầu này, chủ nhà phù hợp sẽ mời bạn" |
| KiGi | Thẻ kết thúc có thêm nút "Đăng nhu cầu này" (dùng bộ lọc KiGi vừa dựng) |
| Lưu bộ lọc (popover cũ) | Ô chọn "Cho chủ nhà phù hợp mời tôi" ngay trong form lưu; biểu tượng bắt tay giữ để bật/tắt nhanh |

Trợ lý AI gõ tay chuyển người dùng sang trang Tìm nhà với bộ lọc đã dựng, nên dùng chung lối vào
của trang Tìm nhà.

### 4.3 Trang "Nhu cầu của tôi" (`/nhu-cau`)

Hai phần:

1. **Nhu cầu đang đăng.** Mỗi thẻ: tên, tóm tắt điều kiện, số người ở, trạng thái (Đang mở cho chủ
   nhà / Chỉ nhận báo tin mới / Đã hết hạn), **"Đang khớp N căn của M chủ nhà"** (bấm → trang Tìm nhà
   với bộ lọc này), hạn còn lại, nút Gia hạn / Tắt / Sửa lời nhắn / Xoá.
2. **Lời mời xem nhà.** Danh sách lời mời hiện có (thành phần `InvitationsList`), thêm hiển thị ưu
   đãi (mục 5.4).

Điều hướng: thêm "Nhu cầu của tôi" vào menu tài khoản (thay mục "Lời mời xem nhà"), có huy hiệu số
lời mời chưa trả lời. Tab "Lời mời xem nhà" ở `/yeu-cau` chuyển hướng sang `/nhu-cau`.

### 4.4 Nhịp cầu (công khai, tổng hợp)

- Hiện ở trang chủ (top khu vực) và trang Tìm nhà (theo loại tin + khu vực đang lọc), ví dụ
  "28 người đang tìm thuê ở Quận Bình Thạnh · 12 người dưới 5 triệu".
- Chỉ đếm nhu cầu **đang mở và còn hạn**; đếm **số người khác nhau**, không đếm số bộ lọc.
- **Ẩn mọi con số dưới 3 người.** Nhóm thô nhất có thể: (loại tin, tỉnh/thành, quận) và khoảng giá cố
  định (mục 6.4). Nhu cầu không ghi quận chỉ góp vào con số cấp tỉnh/thành.

## 5. Trải nghiệm phía chủ nhà (Đợt 2)

### 5.1 Bước 2 đăng tin

Dưới ô giá: "Có N người đang tìm thuê ở Quận 7 — tin của bạn sẽ được giới thiệu tới họ sau khi
duyệt." Dùng chung API Nhịp cầu; ẩn khi dưới 3.

### 5.2 Báo khi tin vừa được duyệt

Sau khi duyệt (đơn lẻ và hàng loạt), một tác vụ nền đếm số nhu cầu khớp tin. Nếu > 0: thông báo cho
người đăng (chuông + email) "Tin '…' khớp N người đang tìm — mời ngay", liên kết mở thẳng danh sách
nhu cầu của tin. Mỗi tin chỉ báo một lần mỗi lượt duyệt.

### 5.3 Danh sách nhu cầu của một tin: hai nhóm

- **Khớp hoàn toàn** — như hiện tại.
- **Gần khớp theo giá** — nhu cầu có trần giá (hoặc trần tổng chi phí) mà tin vượt **không quá 10%**,
  mọi điều kiện khác khớp đủ. Thẻ ghi rõ "Ngân sách thấp hơn giá tin X%". Không có nhóm gần khớp nào
  khác.

Mỗi thẻ (ẩn danh) hiện thêm: số người ở, ngày muốn dọn vào, có thú cưng hay không (lấy từ bộ lọc).

### 5.4 Lời mời kèm ưu đãi riêng

Khi mời, người đăng có thể thêm (đều tuỳ chọn):

- **Giá ưu đãi cho riêng bạn**: phải > 0 và **thấp hơn giá niêm yết** của tin. Với nhu cầu gần khớp
  theo giá, ô này gợi ý sẵn mức ngân sách của người tìm.
- **Dòng ưu đãi**: tối đa 120 ký tự (ví dụ "miễn phí gửi xe 3 tháng").

Người tìm thấy ưu đãi nổi bật trên thẻ lời mời ("Giá niêm yết 5,5 triệu → giá cho bạn 5 triệu").
Khi nhận lời, giá và dòng ưu đãi được **ghi cứng vào yêu cầu xem nhà** để cả hai bên cùng thấy trong
hộp thư. Ưu đãi sai sự thật được báo qua luồng báo vi phạm tin hiện có (lý do "Sai thông tin").

### 5.5 "Tin của tôi"

Huy hiệu nhu cầu luôn hiện: có người thì nổi bật ("5 người đang tìm căn như thế này"), không có thì
mờ kèm gợi ý "Chưa có ai — nhu cầu mới sẽ được báo cho bạn".

### 5.6 Hạn 30 ngày

Bật chế độ mở → hạn 30 ngày. Còn 3 ngày thì nhắc một lần (chuông + email, nút Gia hạn). Hết hạn thì
**chỉ tắt chế độ mở**; bộ lọc và báo tin mới giữ nguyên. Gia hạn = thêm 30 ngày kể từ lúc bấm.

### 5.7 Chỉ số trên trang Tổng quan quản trị

Trong cửa sổ 7/30/90 ngày: số nhu cầu đang mở, số lời mời đã gửi, tỉ lệ nhận lời, tỉ lệ lời mời có ưu
đãi.

### 5.8 Sửa kèm

Đoạn giới thiệu trang "Yêu cầu xem nhà" còn nhắc "ký hợp đồng" (mô-đun quản lý tài sản đã gỡ) —
viết lại cho đúng.

## 6. Thiết kế kỹ thuật

### 6.1 Dữ liệu

| Thay đổi | Ghi chú |
|---|---|
| `PublicListingSearchQuery.Occupants` (int?, 1–20) | Điều kiện lọc mới: tin khớp khi `Terms.MaxOccupants` trống hoặc ≥ `Occupants`. Đặt trong `ListingSearchFilter.Apply` nên trang Tìm nhà, báo tin mới và ghép đôi hiểu giống nhau. Lưu trong `CriteriaJson`, không cần cột mới |
| `SavedSearch.DiscoverableUntil` (DateTime?) | Hạn của chế độ mở. Migration: nhu cầu đang mở được đặt = hôm nay + 30 ngày |
| `SavedSearch.ExpiryRemindedAt` (DateTime?) | Đã nhắc sắp hết hạn chưa |
| `ListingInvitation.OfferPrice` (decimal?), `OfferNote` (string?, 120) | Ưu đãi riêng |
| `ListingInquiry.OfferPrice`, `OfferNote` | Bản ghi cứng khi nhận lời |

Một migration EF Core cho cả nhóm.

### 6.2 API

| Phương thức | Đường dẫn | Thay đổi |
|---|---|---|
| POST | `/api/saved-searches` | Thêm `Discoverable` (bool) và `DemandNote` vào yêu cầu tạo — đăng nhu cầu bằng một lần gọi |
| POST | `/api/saved-searches/{id}/renew` | Mới — gia hạn chế độ mở 30 ngày |
| GET | `/api/saved-searches` | Mỗi bộ lọc trả thêm `DiscoverableUntil`, `MatchingListings` (N), `MatchingOwners` (M) |
| GET | `/api/demand-pulse?type=&city=&district=` | Mới, công khai: tổng số người + phân theo khoảng giá, đã áp ngưỡng 3 |
| GET | `/api/demand-pulse/top?type=` | Mới, công khai: các khu đang có nhiều người tìm nhất (trang chủ) |
| GET | `/api/matchmaking/listings/{id}/demands` | Mỗi nhu cầu thêm `MatchKind` (`Exact` / `NearPrice`), `OverBudgetPercent`, `Occupants`, `AvailableBy`, `PetsAllowed` |
| POST | `/api/matchmaking/listings/{id}/invitations` | Thêm `OfferPrice`, `OfferNote` |
| GET | `/api/matchmaking/invitations` | Trả thêm ưu đãi và giá niêm yết |
| GET | `/api/admin/overview` | Thêm khối chỉ số ghép đôi |

### 6.3 Thành phần máy chủ

| Thành phần | Loại | Trách nhiệm |
|---|---|---|
| `DemandPulse` | Quy tắc thuần (Domain/Rules) | Từ danh sách (người, loại tin, tỉnh, quận, trần giá) → đếm số người khác nhau theo nhóm và khoảng giá, bỏ nhóm dưới 3. Không chạm CSDL |
| `DemandPulseService` | Service | Đọc nhu cầu đang mở còn hạn (chỉ các cột cần, giải mã `CriteriaJson`), gọi `DemandPulse`, đệm 10 phút |
| `NearMatch` | Quy tắc thuần | Từ bộ lọc → bản nới 10% trần giá và trần tổng chi phí; tính % vượt ngân sách. Nhu cầu không có trần giá thì không có bản nới |
| `InvitationOffer` | Quy tắc thuần | Kiểm tra giá ưu đãi (> 0, < giá niêm yết) và độ dài dòng ưu đãi |
| `DemandExpiry` | Quy tắc thuần | Tính hạn khi bật/gia hạn; quyết định nhu cầu nào cần nhắc, nhu cầu nào tắt |
| `MatchmakingService` | Service (sửa) | Thêm nhóm gần khớp; nhận ưu đãi khi mời; chép ưu đãi vào yêu cầu xem nhà khi nhận lời; **lọc sơ trong bộ nhớ** (cùng loại tin, cùng tỉnh/thành) trước khi chạy truy vấn so khớp để giảm số truy vấn |
| `DemandMatchNotifyJob` | Tác vụ nền (Hangfire, đưa vào hàng đợi khi duyệt) | Đếm nhu cầu khớp một tin vừa duyệt, báo người đăng nếu > 0 |
| `SavedSearchAlertJob` | Tác vụ nền (sửa, 08:30 sẵn có) | Thêm bước nhắc sắp hết hạn và tắt chế độ mở khi hết hạn |
| `ShowcaseSeeder`/`ShowcaseCatalog` | Dữ liệu mẫu | Thêm khoảng 12 người tìm nhà và 35–40 nhu cầu mở, dồn vào các quận có tin; có ít nhất 2 nhu cầu gần khớp theo giá với tin sẵn có |

### 6.4 Khoảng giá của Nhịp cầu

- Thuê (theo trần giá hoặc trần tổng chi phí): dưới 3 tr · 3–5 tr · 5–10 tr · 10–20 tr · trên 20 tr.
- Mua: dưới 2 tỷ · 2–5 tỷ · 5–10 tỷ · 10–20 tỷ · trên 20 tỷ.
- Nhu cầu không có trần giá chỉ góp vào tổng, không vào khoảng nào.

### 6.5 Hiệu năng

- Nhịp cầu: không so khớp tin, chỉ đọc nhu cầu và đếm trong bộ nhớ, đệm 10 phút.
- "Nhu cầu của tôi": tối đa 20 nhu cầu × 1 truy vấn đếm, chỉ khi người dùng mở trang của mình.
- Danh sách nhu cầu của một tin: lọc sơ trong bộ nhớ, rồi tối đa 2 truy vấn mỗi nhu cầu còn lại
  (khớp hoàn toàn, rồi gần khớp nếu cần).
- Báo khi duyệt: chạy nền, không làm chậm nút duyệt.

### 6.6 Thành phần giao diện

| Thành phần | Trách nhiệm |
|---|---|
| `PostDemandDialog` | Hộp đăng nhu cầu dùng chung; lưu/khôi phục bản nháp cho khách |
| `DemandPulseCard` / `DemandPulseLine` | Hiện Nhịp cầu (thẻ ở trang chủ, một dòng ở trang Tìm nhà và bước 2 đăng tin) |
| Route `/nhu-cau` | Trang "Nhu cầu của tôi" |
| `InvitationsList` (sửa) | Hiện ưu đãi |
| `ListingDemandsSheet` (sửa) | Hai nhóm khớp/gần khớp; ô ưu đãi trong hộp mời |
| `SavedSearchesPopover` (sửa) | Ô chọn mở cho chủ nhà khi lưu |
| KiGi thẻ kết thúc (sửa) | Nút "Đăng nhu cầu này" |

## 7. Quyền riêng tư và chống lạm dụng (giữ và thêm)

- Chủ nhà chỉ thấy nhu cầu ẩn danh; tên, số điện thoại chỉ lộ khi người tìm nhận lời (giữ).
- Nhịp cầu chỉ là con số gộp, ngưỡng 3 người, nhóm thô (mới).
- Tối đa 30 lời mời/ngày mỗi chủ nhà; một lời mời mỗi cặp (tin, nhu cầu) (giữ).
- Giá ưu đãi phải thấp hơn giá niêm yết và được ghi cứng khi nhận lời (mới).
- Hạn 30 ngày để nhu cầu không còn thật thì không làm phiền chủ nhà và không thổi phồng Nhịp cầu (mới).

## 8. Kiểm thử

Backend (xUnit), tập trung vào quy tắc thuần:

- `DemandPulse`: đếm theo người khác nhau; ẩn nhóm dưới 3; nhu cầu không quận chỉ vào cấp tỉnh;
  phân khoảng giá đúng cho thuê và mua.
- `NearMatch`: nới 10% đúng; không có trần giá thì không gần khớp; tính % vượt ngân sách.
- `InvitationOffer`: từ chối giá ≥ giá niêm yết, giá ≤ 0, dòng ưu đãi > 120 ký tự.
- `DemandExpiry`: hạn khi bật/gia hạn; chọn đúng nhu cầu cần nhắc (một lần) và cần tắt.
- Điều kiện `Occupants` trong `ListingSearchFilter`: tin không ghi số người tối đa vẫn khớp.
- `ShowcaseCatalog`: dữ liệu mẫu có ít nhất 3 quận đạt ngưỡng Nhịp cầu và ít nhất 2 cặp gần khớp
  theo giá.

Giao diện (Vitest): lưu và khôi phục bản nháp nhu cầu của khách.

Kiểm tra trên trình duyệt: 5 lối vào hiện đúng; đăng nhu cầu 1–2 bấm; khách đăng nhập rồi quay lại
đúng hộp; Nhịp cầu hiện ở trang chủ và trang Tìm nhà; chủ nhà thấy nhóm gần khớp, mời kèm ưu đãi,
người tìm thấy ưu đãi và nhận lời.

## 9. Tiêu chí thành công

- Bật "cho chủ nhà tìm thấy" từ 5 bước còn 1–2 bấm, ngay từ trang Tìm nhà.
- Trên dữ liệu trình diễn: Nhịp cầu hiện ở mọi quận có tin chính; có ít nhất một tin có nhu cầu gần
  khớp theo giá để trình diễn lời mời ưu đãi.
- Không đường chờ nào của người dùng chạy so khớp hàng loạt.
- Toàn bộ test cũ và mới đều đạt.

## 10. Chia đợt

- **Đợt 1 — ai cũng thấy và dùng được:** mục 4 (hộp đăng nhu cầu, 5 lối vào, `/nhu-cau`, Nhịp cầu),
  trường `Occupants`, hạn 30 ngày (mục 5.6 — Nhịp cầu và nút Gia hạn ở `/nhu-cau` cần nó ngay), dữ
  liệu mẫu.
- **Đợt 2 — chủ nhà mời hiệu quả:** phần còn lại của mục 5 (bước 2 đăng tin, báo khi duyệt, gần khớp
  theo giá, ưu đãi, huy hiệu luôn hiện, chỉ số quản trị, sửa câu giới thiệu).

# Kiểm duyệt "Đăng nhu cầu"

Ngày: 28/10/2026 · Nhánh: `feat/duyet-nhu-cau`

## 1. Vấn đề

Nhu cầu mở cho chủ nhà (`SavedSearch.DiscoverableByOwners`) hiện ra ngay với chủ nhà và được
đếm vào Nhịp cầu. Lời nhắn kèm nhu cầu (`DemandNote`, ≤300 ký tự) là chỗ dễ bị lợi dụng: chèn
liên kết, số điện thoại, rao vặt. Một tài khoản cũng có thể mở hàng loạt nhu cầu để thổi phồng
Nhịp cầu.

## 2. Quyết định

Duyệt tay kết hợp tự duyệt ca sạch: mỗi lần nhu cầu được mở (hoặc lời nhắn đổi), máy chủ chạy
bộ kiểm tra tự động. Không dính dấu hiệu nào → duyệt ngay. Dính → chờ quản trị duyệt.

Ngoài phạm vi: kiểm duyệt bộ lọc đã lưu thông thường (không mở cho chủ nhà), nút "báo spam" cho
chủ nhà, AI phân loại nội dung.

## 3. Trạng thái

`SavedSearch.DemandReview` (enum `DemandReviewStatus`): `Approved = 1`, `Pending = 2`,
`Rejected = 3`; cùng `DemandReviewReason` (string ≤300, lý do giữ lại hoặc từ chối, dạng câu
cho người dùng đọc) và `DemandReviewedAt` (DateTime?).

- Chỉ có nghĩa khi `DiscoverableByOwners = true`.
- `DemandExpiry.OpenAt` thêm điều kiện `DemandReview == Approved`. Mọi chỗ đọc "nhu cầu đang mở"
  đã đi qua biểu thức này (danh sách nhu cầu của tin, huy hiệu Tin của tôi, Nhịp cầu, tác vụ báo
  khi duyệt tin, lời mời, chỉ số quản trị), nên nhu cầu chưa duyệt không lọt ra chỗ nào.
- Migration: mọi bản ghi hiện có đặt `Approved` (mặc định cột = 1). Dữ liệu mẫu: `Approved`.

## 4. Kiểm tra tự động — `DemandScreening` (quy tắc thuần)

`Screen(name, note, emailConfirmed, openedLast24h) → IReadOnlyList<string>` — danh sách lý do,
rỗng = sạch. Lý do viết cho người tìm đọc:

| Dấu hiệu | Lý do hiện cho người dùng |
|---|---|
| Liên kết: `http`, `www.`, tên miền `.com .vn .net .org .info .xyz .me` | "Lời nhắn có đường liên kết" |
| Số điện thoại: chuỗi 9–11 chữ số (bỏ dấu cách, chấm, gạch) | "Lời nhắn có số điện thoại" |
| Email | "Lời nhắn có địa chỉ email" |
| "zalo", "facebook", "fb.com", "telegram" (không phân biệt dấu, hoa thường) | "Lời nhắn có kênh liên lạc riêng" |
| Rao vặt: "cho thuê", "cần bán", "môi giới", "vay vốn", "tuyển dụng", "khuyến mãi" | "Lời nhắn giống tin rao vặt" |
| Tài khoản chưa xác thực email | "Tài khoản chưa xác thực email" |
| Đã mở từ 3 nhu cầu trở lên trong 24 giờ (kể cả cái này là cái thứ 4) | "Đăng nhiều nhu cầu trong thời gian ngắn" |

Kiểm tra cả `Name` lẫn `DemandNote`.

## 5. Khi nào kiểm tra

| Thao tác | Kết quả |
|---|---|
| Tạo nhu cầu mở (`CreateAsync` với `Discoverable`) | Kiểm tra |
| Bật mở lại (`SetDiscoverableAsync` enable) | Kiểm tra |
| Sửa lời nhắn (`SetDiscoverableAsync` với note khác note cũ) | Kiểm tra lại |
| Gia hạn (`RenewAsync`) | Giữ nguyên trạng thái, trừ khi đang `Rejected` → kiểm tra lại |
| Tắt | Giữ nguyên trạng thái |

"Mở trong 24 giờ" đếm các nhu cầu của người đó có `DiscoverableSince` trong 24 giờ qua.

## 6. Phía người tìm

- `SavedSearchDto` thêm `DemandReview`, `DemandReviewReason`.
- Hộp Đăng nhu cầu: sạch → toast cũ; bị giữ → "Đã gửi — đang chờ duyệt" kèm lý do.
- Popover lưu bộ lọc và nút "Mở cho chủ nhà mời" ở `/nhu-cau`: cùng cách báo.
- `MyDemandCard`: nhãn "Chờ duyệt" (kèm lý do) / "Bị từ chối: lý do"; nhu cầu bị từ chối có
  nút "Sửa lời nhắn và gửi lại". Trạng thái "Đang mở cho chủ nhà" chỉ khi đã duyệt.
- Thông báo (chuông + email) khi quản trị duyệt hoặc từ chối.

## 7. Phía quản trị

- API `api/admin/demands`:
  - `GET pending` — hàng đợi: tên, tóm tắt điều kiện, lời nhắn, lý do bị giữ, người đăng (tên,
    email, đã xác thực chưa, ngày tham gia), thời điểm gửi. Mới nhất lên đầu.
  - `POST {id}/approve`, `POST {id}/reject` (body: `reason`, bắt buộc), `POST bulk` (danh sách id,
    approve/reject + reason).
- Trang `/admin/nhu-cau` "Duyệt nhu cầu" theo khuôn trang duyệt tin; mục trong menu quản trị có
  huy hiệu số chờ duyệt.
- Trang tổng quan: khối Ghép đôi thêm "Nhu cầu chờ duyệt".

## 8. Kiểm thử

- `DemandScreeningTests`: từng dấu hiệu bắt đúng; lời nhắn bình thường ("2 người đi làm Quận 1,
  dọn vào đầu tháng") sạch; số tiền ("dưới 5.000.000") không bị nhầm là số điện thoại; ngưỡng
  3 nhu cầu/24 giờ.
- `DemandExpiryTests.OpenAt` bỏ qua nhu cầu `Pending`/`Rejected`.
- Kiểm tra trên trình duyệt: đăng sạch → hiện ngay; đăng có số điện thoại → chờ duyệt, chủ nhà
  không thấy; quản trị duyệt → chủ nhà thấy, người tìm nhận thông báo; từ chối → nhãn và lý do.

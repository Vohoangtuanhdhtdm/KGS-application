# `GET /assets/map-pins`

Đã triển khai. Tài liệu này giữ lại phần hợp đồng dữ liệu mà frontend đang dựa vào, và ghi
lại vì sao endpoint tồn tại — để sau này không ai "tối ưu" nó thành endpoint phân trang.

## Hợp đồng

```
GET /assets/map-pins
```

Không tham số. Trả **toàn bộ** tài sản của người dùng hiện tại, không phân trang.

### Response `200 OK`

```jsonc
[
  {
    "id": "3f2a...",
    "name": "Biệt thự Thảo Điền",
    "type": 2,
    "ownershipType": 1,
    "status": 2,
    "city": "TP. Hồ Chí Minh",
    "district": "Thủ Đức",
    "currentValue": 24500000000,
    "thumbnailUrl": "https://.../thumb.jpg",
    "linkedPropertyId": null,
    "latitude": 10.8021, // null nếu tài sản chưa gắn vị trí
    "longitude": 106.7411 // null nếu tài sản chưa gắn vị trí
  }
]
```

Đúng shape của `AssetListItem`, cộng `latitude` và `longitude`. Kiểu tương ứng ở frontend
là `AssetMapItem` trong `src/lib/api/assets.ts`.

### Hai ràng buộc dễ phá vỡ

| Điểm | Yêu cầu | Vì sao |
| --- | --- | --- |
| Tài sản chưa có vị trí | Vẫn phải trả về, `latitude`/`longitude` = `null` | Overlay danh sách liệt kê chúng riêng kèm nút "Bổ sung". Lọc bỏ ở server là người dùng không bao giờ biết mình còn tài sản chưa gắn vị trí. |
| Không phân trang | Trả hết trong một response | Đây là dữ liệu vẽ bản đồ, thiếu một phần thì bản đồ nói dối. Xem phần dưới. |

## Vì sao endpoint này tồn tại

Trước khi có nó, `GET /assets` không trả toạ độ — chỉ `GET /assets/{id}` mới có `location`.
Frontend phải ghép ở client: 1 request danh sách + **1 request detail cho mỗi tài sản**.
Danh mục 120 tài sản = 121 request mỗi lần mở bản đồ, chỉ để lấy hai con số.

Vì quá đắt nên phải đặt trần 200 tài sản, và vì có trần nên lại phải thêm cảnh báo
"đang hiển thị N trong tổng số M" để bản đồ không âm thầm giấu tài sản của người dùng.

Endpoint này xoá sạch cả chuỗi đó: trần, cảnh báo, phần nạp sẵn cache detail và
`staleTime` đi kèm — tất cả đã gỡ khỏi code. Nếu sau này endpoint bị đổi thành phân trang
thì toàn bộ chuỗi vá đó sẽ phải quay lại.

# Bảng z-index

Tài liệu này tồn tại vì đã có **ba** lỗi riêng biệt cùng một nguyên nhân: một lớp khai báo
`z-index` rất cao nhưng vẫn bị lớp khác che. Trước khi thêm lớp nổi mới, đọc phần "Luật"
bên dưới rồi mới chọn số.

## Luật

1. **`z-index` chỉ so được với anh em cùng stacking context.** Một phần tử `position` khác
   `static` + có `z-index` (kể cả `z-0`) tạo ra context mới, nhốt toàn bộ con cháu bên
   trong. `z-1000` bên trong context `z-0` vẫn thua `z-10` ở ngoài.
2. **Wrapper bản đồ ở `src/routes/ban-do.index.tsx` BẮT BUỘC giữ `z-0`.** Pane của Leaflet
   dùng z-index 400–700; thiếu context này chúng leo lên đè mọi lớp nổi. Đây không phải
   thứ được "dọn cho gọn".
3. **Hệ quả: lớp nào phải nổi trên toàn ứng dụng thì phải `createPortal` ra
   `document.body`**, đổi sang `position: fixed` và quy toạ độ về viewport (cộng
   `getBoundingClientRect()` của container bản đồ). Nâng `z-index` tại chỗ là vá tạm và
   sẽ hỏng lại.
4. **Esc chỉ được lớp trên cùng xử lý.** Lớp nằm dưới phải tự bỏ qua, ví dụ thẻ xem nhanh
   kiểm tra `document.querySelector('[role="dialog"][aria-modal="true"]')` trước khi đóng.
5. Mọi lớp modal dùng chung `useFocusTrap` (`src/hooks/useFocusTrap.ts`) — không tự viết
   lại logic giam/trả focus.

## Thang số

Tất cả các lớp dưới đây đều nằm ở **ROOT context** (portal ra `document.body`), nên các số
này so sánh được trực tiếp với nhau.

| z    | Lớp                        | Nguồn                                    |
| ---- | -------------------------- | ---------------------------------------- |
| 0    | Container bản đồ (Leaflet) | `src/routes/ban-do.index.tsx`            |
| 10   | Panel thống kê nổi         | `MapStatPanels` trong `ban-do.index.tsx` |
| 20   | Báo lỗi / trạng thái rỗng  | `ban-do.index.tsx`                       |
| 840  | Nền mờ làm nổi tài sản     | `.asset-spotlight` — `styles.css`        |
| 845  | Vòng sáng quanh marker     | `.asset-selected-ring` — `styles.css`    |
| 850  | Thẻ xem nhanh tài sản      | `.asset-quickcard` — `styles.css`        |
| 870  | Thanh nổi trên cùng        | `ban-do.index.tsx`                       |
| 870  | Nút thêm tài sản           | `ban-do.index.tsx`                       |
| 875  | Panel chi tiết cột phải    | `ban-do.index.tsx`                       |
| 880  | Overlay danh sách tài sản  | `AssetListOverlay.tsx`                   |
| 900  | Thanh tab dưới đáy         | `BottomTabBar.tsx`                       |
| 920  | Sheet tính năng            | `FeatureSheet.tsx`                       |
| 950  | Sheet "Thêm"               | `MoreSheet.tsx`                          |
| 1000 | Dialog chi tiết tài sản    | `AssetDetailDialog.tsx`                  |

Vì sao có khoảng trống lớn giữa 20 và 840: nhóm 840–850 phải nằm trên bản đồ nhưng **dưới**
thanh nổi và thanh tab, để lúc thẻ xem nhanh đang mở người dùng vẫn tìm kiếm/chuyển tab
được. Nhóm 870+ là các lớp điều hướng. Chừa khoảng trống để chèn lớp mới không phải đánh số
lại cả bảng.

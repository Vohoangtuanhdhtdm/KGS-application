# Đánh giá trợ lý tìm nhà

43 câu hỏi (cases.json). Đo toàn bộ đường đi: prompt → Groq → tầng kiểm tra phía máy chủ.

| Mô hình | Khớp hoàn toàn | Precision | Recall | Mong muốn mềm | Điểm neo | Báo khu vực lạ | p50 | p95 | Token TB | Lỗi |
|---|---|---|---|---|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 91% | 98% | 98% | 100% | 100% | 100% | 1304 ms | 1587 ms | 1827 | 0 |
| `qwen/qwen3.8-27b` | 88% | 97% | 99% | 90% | 98% | 100% | 675 ms | 791 ms | 1141 | 0 |

## Các câu chưa khớp hoàn toàn

- `openai/gpt-oss-120b` #2 "Tìm phòng trọ quận Gò Vấp tầm 3 triệu, giờ giấc tự do" → priceMin: kỳ vọng 2700000 – nhận None; priceMax: kỳ vọng 3300000 – nhận 3000000
- `openai/gpt-oss-120b` #10 "Thuê phòng bắt buộc phải có WC riêng và chỗ để xe, quận 3" → bathroomsMin: kỳ vọng None – nhận 1
- `openai/gpt-oss-120b` #13 "Thuê nhà riêng 2 tầng ở Gò Vấp khoảng 10 triệu, hẻm xe hơi" → priceMin: kỳ vọng 9000000 – nhận None; priceMax: kỳ vọng 11000000 – nhận 10000000
- `openai/gpt-oss-120b` #31 "Cần căn hộ 2PN cho thuê, làm ở đường Hàm Nghi, đi xe máy tối đa 20 phút, tổng chi phí dưới 12tr, có ban công" → district: kỳ vọng None – nhận Quận 1
- `qwen/qwen3.8-27b` #8 "Phòng trọ ở Tân Bình, tổng chi phí dưới 5 triệu bao gồm phí dịch vụ" → priceMax: kỳ vọng None – nhận 5000000
- `qwen/qwen3.8-27b` #19 "Mua biệt thự trên 20 tỷ ở Thủ Đức" → priceMin: kỳ vọng 20000000000 – nhận 2000000000
- `qwen/qwen3.8-27b` #22 "Tìm mua văn phòng trên 100m2 quận 1" → priceMin: kỳ vọng None – nhận 100000000
- `qwen/qwen3.8-27b` #31 "Cần căn hộ 2PN cho thuê, làm ở đường Hàm Nghi, đi xe máy tối đa 20 phút, tổng chi phí dưới 12tr, có ban công" → priceMax: kỳ vọng None – nhận 12000000
- `qwen/qwen3.8-27b` #43 "Cho mình xem vài căn nhà đẹp" → type: kỳ vọng None – nhận 1; propertyTypes: kỳ vọng None – nhận [1, 4, 5]

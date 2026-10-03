# Đánh giá trợ lý tìm nhà

43 câu hỏi (cases.json). Đo toàn bộ đường đi: prompt → Groq → tầng kiểm tra phía máy chủ.

| Mô hình | Khớp hoàn toàn | Precision | Recall | Mong muốn mềm | Điểm neo | Báo khu vực lạ | p50 | p95 | Token TB | Lỗi |
|---|---|---|---|---|---|---|---|---|---|---|
| `openai/gpt-oss-120b` | 79% | 95% | 93% | 60% | 100% | 100% | 1304 ms | 1470 ms | 1792 | 0 |
| `openai/gpt-oss-20b` | 51% | 87% | 89% | 60% | 100% | 100% | 893 ms | 1099 ms | 1749 | 0 |
| `qwen/qwen3.8-27b` | 77% | 92% | 95% | 70% | 98% | 100% | 665 ms | 820 ms | 1104 | 0 |

## Các câu chưa khớp hoàn toàn

- `openai/gpt-oss-120b` #2 "Tìm phòng trọ quận Gò Vấp tầm 3 triệu, giờ giấc tự do" → priceMin: kỳ vọng 2700000 – nhận None; priceMax: kỳ vọng 3300000 – nhận 3000000
- `openai/gpt-oss-120b` #9 "Thuê phòng có máy lạnh, wifi, gần chợ, Phú Nhuận, tầm 4tr" → priceMin: kỳ vọng 3600000 – nhận None; priceMax: kỳ vọng 4400000 – nhận 4000000; amenities: kỳ vọng None – nhận ['air_conditioner', 'wifi']
- `openai/gpt-oss-120b` #13 "Thuê nhà riêng 2 tầng ở Gò Vấp khoảng 10 triệu, hẻm xe hơi" → priceMin: kỳ vọng 9000000 – nhận None; priceMax: kỳ vọng 11000000 – nhận 10000000
- `openai/gpt-oss-120b` #14 "Cho thuê phòng trọ có gác lửng giá rẻ dưới 2tr5" → priceMax: kỳ vọng 2500000 – nhận 2500000000; amenities: kỳ vọng None – nhận ['loft']
- `openai/gpt-oss-120b` #16 "Mua đất nền 80-120m2 có sổ hồng ở Thủ Đức, khoảng 2 tỷ" → priceMin: kỳ vọng 1800000000 – nhận None; priceMax: kỳ vọng 2200000000 – nhận 2000000000
- `openai/gpt-oss-120b` #23 "Mua nhà có sổ đỏ, 3 tỷ 5 trở xuống, Gò Vấp" → legalStatuses: kỳ vọng ['Sổ hồng chung', 'Sổ hồng riêng', 'Sổ đỏ'] – nhận ['Sổ đỏ']
- `openai/gpt-oss-120b` #31 "Cần căn hộ 2PN cho thuê, làm ở đường Hàm Nghi, đi xe máy tối đa 20 phút, tổng chi phí dưới 12tr, có ban công" → amenities: kỳ vọng None – nhận ['balcony']
- `openai/gpt-oss-120b` #39 "thêm điều kiện cho nuôi thú cưng" → furnitureStates: kỳ vọng ['Đầy đủ'] – nhận None
- `openai/gpt-oss-120b` #41 "đổi sang Quận 7" → priceMin: kỳ vọng 1800000000 – nhận None; priceMax: kỳ vọng 2200000000 – nhận 2000000000
- `openai/gpt-oss-20b` #2 "Tìm phòng trọ quận Gò Vấp tầm 3 triệu, giờ giấc tự do" → priceMin: kỳ vọng 2700000 – nhận None; priceMax: kỳ vọng 3300000 – nhận 3000000
- `openai/gpt-oss-20b` #3 "Cho thuê căn hộ 2 phòng ngủ Quận 7 dưới 15 triệu, đầy đủ nội thất" → propertyTypes: kỳ vọng [2] – nhận [7]
- `openai/gpt-oss-20b` #4 "Thuê chung cư 3PN 2WC ở Thủ Đức, tối đa 20tr" → district: kỳ vọng TP. Thủ Đức – nhận None
- `openai/gpt-oss-20b` #9 "Thuê phòng có máy lạnh, wifi, gần chợ, Phú Nhuận, tầm 4tr" → priceMin: kỳ vọng 3600000 – nhận None; priceMax: kỳ vọng 4400000 – nhận 4000000000; amenities: kỳ vọng None – nhận ['air_conditioner', 'wifi']
- `openai/gpt-oss-20b` #10 "Thuê phòng bắt buộc phải có WC riêng và chỗ để xe, quận 3" → bathroomsMin: kỳ vọng None – nhận 1
- `openai/gpt-oss-20b` #11 "Mình nuôi chó, cần thuê nhà riêng nguyên căn ở Quận 4" → propertyTypes: kỳ vọng [1] – nhận [1, 4, 5]
- `openai/gpt-oss-20b` #13 "Thuê nhà riêng 2 tầng ở Gò Vấp khoảng 10 triệu, hẻm xe hơi" → priceMin: kỳ vọng 9000000 – nhận None; priceMax: kỳ vọng 11000000 – nhận 10000000; propertyTypes: kỳ vọng [1] – nhận [7]
- `openai/gpt-oss-20b` #15 "Thuê căn hộ có ban công view sông ở Bình Thạnh" → propertyTypes: kỳ vọng [2] – nhận [7]; amenities: kỳ vọng None – nhận ['balcony']
- `openai/gpt-oss-20b` #16 "Mua đất nền 80-120m2 có sổ hồng ở Thủ Đức, khoảng 2 tỷ" → priceMin: kỳ vọng 1800000000 – nhận None; priceMax: kỳ vọng 2200000000 – nhận 2000000000
- `openai/gpt-oss-20b` #20 "Cần mua nhà riêng hướng Nam hoặc Đông, 4 phòng ngủ, Tân Bình, dưới 8 tỷ" → propertyTypes: kỳ vọng [1] – nhận [1, 4, 5]
- `openai/gpt-oss-20b` #23 "Mua nhà có sổ đỏ, 3 tỷ 5 trở xuống, Gò Vấp" → legalStatuses: kỳ vọng ['Sổ hồng chung', 'Sổ hồng riêng', 'Sổ đỏ'] – nhận ['Sổ đỏ']
- `openai/gpt-oss-20b` #26 "Mua căn hộ 70m2 trở lên đầy đủ nội thất quận 4 dưới 4 tỷ" → amenities: kỳ vọng None – nhận ['furnished']
- `openai/gpt-oss-20b` #30 "mua đất dưới 1 tỷ" → propertyTypes: kỳ vọng [3] – nhận [1, 4, 5]
- `openai/gpt-oss-20b` #31 "Cần căn hộ 2PN cho thuê, làm ở đường Hàm Nghi, đi xe máy tối đa 20 phút, tổng chi phí dưới 12tr, có ban công" → priceMax: kỳ vọng None – nhận 12000000
- `openai/gpt-oss-20b` #32 "Thuê phòng trọ gần Đại học Bách Khoa, đi bộ 10 phút" → district: kỳ vọng None – nhận Quận 1
- `openai/gpt-oss-20b` #33 "Tìm phòng trọ gần chợ Bến Thành dưới 5 triệu" → district: kỳ vọng None – nhận Quận 1
- `openai/gpt-oss-20b` #34 "Mua căn hộ trong bán kính 5km quanh sân bay Tân Sơn Nhất" → propertyTypes: kỳ vọng [2] – nhận [1, 4, 5]
- `openai/gpt-oss-20b` #35 "Thuê nhà riêng gần Trường Quốc tế Úc, đạp xe 15 phút" → district: kỳ vọng None – nhận Quận 1; propertyTypes: kỳ vọng [1] – nhận [7]
- `openai/gpt-oss-20b` #39 "thêm điều kiện cho nuôi thú cưng" → propertyTypes: kỳ vọng [2] – nhận [7]
- `openai/gpt-oss-20b` #41 "đổi sang Quận 7" → priceMin: kỳ vọng 1800000000 – nhận None; priceMax: kỳ vọng 2200000000 – nhận 2000000000
- `openai/gpt-oss-20b` #43 "Cho mình xem vài căn nhà đẹp" → type: kỳ vọng None – nhận 1; propertyTypes: kỳ vọng None – nhận [1, 4, 5]
- `qwen/qwen3.8-27b` #2 "Tìm phòng trọ quận Gò Vấp tầm 3 triệu, giờ giấc tự do" → priceMin: kỳ vọng 2700000 – nhận None; priceMax: kỳ vọng 3300000 – nhận 3000000
- `qwen/qwen3.8-27b` #4 "Thuê chung cư 3PN 2WC ở Thủ Đức, tối đa 20tr" → petsAllowed: kỳ vọng None – nhận False; curfewFree: kỳ vọng None – nhận False; sharedWithOwner: kỳ vọng None – nhận False
- `qwen/qwen3.8-27b` #9 "Thuê phòng có máy lạnh, wifi, gần chợ, Phú Nhuận, tầm 4tr" → priceMin: kỳ vọng 3600000 – nhận None; priceMax: kỳ vọng 4400000 – nhận 4000000; amenities: kỳ vọng None – nhận ['air_conditioner', 'wifi']
- `qwen/qwen3.8-27b` #16 "Mua đất nền 80-120m2 có sổ hồng ở Thủ Đức, khoảng 2 tỷ" → legalStatuses: kỳ vọng ['Sổ hồng chung', 'Sổ hồng riêng', 'Sổ đỏ'] – nhận ['Sổ hồng chung', 'Sổ hồng riêng']
- `qwen/qwen3.8-27b` #19 "Mua biệt thự trên 20 tỷ ở Thủ Đức" → priceMin: kỳ vọng 20000000000 – nhận 2000000000
- `qwen/qwen3.8-27b` #22 "Tìm mua văn phòng trên 100m2 quận 1" → priceMin: kỳ vọng None – nhận 1000000000
- `qwen/qwen3.8-27b` #23 "Mua nhà có sổ đỏ, 3 tỷ 5 trở xuống, Gò Vấp" → legalStatuses: kỳ vọng ['Sổ hồng chung', 'Sổ hồng riêng', 'Sổ đỏ'] – nhận ['Sổ đỏ']
- `qwen/qwen3.8-27b` #25 "Mua shophouse quận 10 khoảng 15 tỏi" → priceMin: kỳ vọng 13500000000 – nhận 1350000000; priceMax: kỳ vọng 16500000000 – nhận 1650000000
- `qwen/qwen3.8-27b` #41 "đổi sang Quận 7" → legalStatuses: kỳ vọng ['Sổ hồng chung', 'Sổ hồng riêng', 'Sổ đỏ'] – nhận ['Sổ hồng chung', 'Sổ hồng riêng']
- `qwen/qwen3.8-27b` #43 "Cho mình xem vài căn nhà đẹp" → type: kỳ vọng None – nhận 1; propertyTypes: kỳ vọng None – nhận [1, 4, 5]

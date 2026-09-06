# Dịch vụ định giá bất động sản (AVM)

Thành phần Luồng B của đồ án: ước tính giá bán một bất động sản từ vị trí, diện tích và
đặc điểm căn nhà. Chạy như một dịch vụ Python riêng, API .NET gọi sang qua HTTP.

## Phạm vi và giới hạn

**Chỉ định giá được mảng MUA BÁN.** Nguồn dữ liệu
([`tinixai/vietnam-real-estates`](https://huggingface.co/datasets/tinixai/vietnam-real-estates))
chỉ chứa tin rao bán — mọi mức giá đều ở hàng tỷ đồng, không có tin cho thuê. Định giá thuê
sẽ cần một nguồn khác, đó là giới hạn của dữ liệu chứ không phải của mô hình.

**Dữ liệu trải 4 tháng** (06/2025 – 09/2025). Đủ để học mặt bằng giá theo khu vực, nhưng
không đủ để mô hình hoá tính mùa vụ hay xu hướng dài hạn.

## Vì sao tách thành dịch vụ riêng

- **Hệ sinh thái.** LightGBM, pandas, scikit-learn đều sống ở Python. Gọi chúng từ .NET nghĩa
  là hoặc chấp nhận một cầu nối mong manh, hoặc dùng bản chuyển đổi luôn chậm hơn bản gốc.
- **Vòng đời khác nhau.** Mô hình huấn luyện lại khi có dữ liệu mới; API nghiệp vụ đổi theo
  tính năng. Buộc chung một tiến trình nghĩa là mỗi lần huấn luyện lại phải triển khai lại
  cả sàn giao dịch.
- **Hỏng độc lập.** Dịch vụ này chết thì trang tin đăng vẫn chạy, chỉ là không hiện ô định
  giá. Nhúng chung thì một lỗi trong thư viện ML kéo sập cả nền tảng.

## Cài đặt

```bash
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Phiên bản trong `requirements.txt` được ghim chính xác: đồ án phải dựng lại được kết quả y
hệt sau nhiều tháng, mà scikit-learn và LightGBM đều từng đổi mặc định giữa các bản minor.

## Huấn luyện

```bash
# 1. Tải và làm sạch dữ liệu (3 shard ≈ 1 triệu dòng thô)
.venv/Scripts/python.exe -m training.prepare_data --shards 3

# Chỉ lấy một vài tỉnh:
.venv/Scripts/python.exe -m training.prepare_data --shards 3 --provinces "ho chi minh,ha noi"

# 2. Huấn luyện mô hình nền + Gradient Boosting, đo trên cùng tập kiểm tra
.venv/Scripts/python.exe -m training.train

# 3. Dựng chỉ số giá theo tuần (Luồng C)
.venv/Scripts/python.exe -m training.build_index
```

Kết quả ghi vào `models/`:

| Tệp | Nội dung |
|---|---|
| `avm.txt` | Mô hình LightGBM |
| `avm.meta.joblib` | Tập hạng mục + danh sách đặc trưng (bắt buộc phải nạp lại lúc phục vụ) |
| `avm.report.json` | Độ đo của cả bốn mô hình, mức đóng góp từng đặc trưng |
| `avm.area_stats.parquet` | Giá trung vị mỗi m² theo quận, kèm cỡ mẫu |
| `price_index.json` | Chỉ số giá theo tuần: toàn quốc, 20 quận, và đường trung vị thô để đối chiếu |

## Chạy dịch vụ

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

| Endpoint | Việc |
|---|---|
| `GET /health` | Dịch vụ sống chưa, mô hình nạp được chưa |
| `GET /model-info` | Độ đo của mô hình đang phục vụ |
| `POST /valuation` | Định giá một bất động sản |
| `GET /price-index` | Chỉ số giá theo tuần (`?province=&district=`) |
| `GET /docs` | Swagger |

Ví dụ:

```bash
curl -X POST http://localhost:8000/valuation -H "Content-Type: application/json" -d '{
  "area": 60, "province": "TP. Hồ Chí Minh", "district": "Quận 8",
  "bedroom_count": 3, "floor_count": 2
}'
```

## Những quyết định đáng chú ý

**Chuẩn hoá tên hành chính là mảnh ghép quyết định.** Bộ dữ liệu ghi quận là `"8"`,
`"Tân Phú"`; nền tảng ghi `"Quận 8"`, `"TP. Thủ Đức"`. Không quy về một dạng thì mô hình học
đặc trưng `"8"` sẽ không bao giờ khớp với tin đăng mang quận `"Quận 8"` — và triệu chứng là
thứ khó phát hiện nhất: mô hình vẫn chạy, vẫn trả về số, chỉ là mọi tin đăng thật đều rơi
vào nhánh "quận lạ". Không lỗi, không log, chỉ sai lặng lẽ. Đây là phần được kiểm thử kỹ
nhất của dịch vụ (34 ca).

**Chia tập theo THỜI GIAN, không ngẫu nhiên.** Chia ngẫu nhiên cho phép mô hình nhìn thấy
tin tháng 9 khi dự đoán tin tháng 6 — biết trước tương lai. Độ đo khi đó đẹp hơn thực tế và
không bao giờ tái hiện được khi triển khai.

**Bỏ tin trùng trước khi chia tập.** 30% dữ liệu thô là tin đăng lại. Giữ nguyên thì cùng
một tin vừa nằm ở tập huấn luyện vừa nằm ở tập kiểm tra, và mô hình "đoán" đúng nó chỉ vì
đã thấy rồi.

**Huấn luyện trên `log(giá)`.** Giá bất động sản lệch phải rất mạnh. Hồi quy thẳng trên giá
khiến hàm mất mát bị chi phối bởi nhóm đắt nhất: sai 500 triệu ở căn 50 tỷ bị phạt nặng như
sai 500 triệu ở căn 1 tỷ, trong khi với người dùng hai cái sai đó khác nhau một trời một vực.

**Độ đo là MdAPE và PPE10/PPE20, không phải RMSE.** RMSE trên giá tuyệt đối bị chi phối bởi
nhóm đắt nhất. PPE10 — tỉ lệ dự đoán nằm trong sai số 10% — là độ đo các nền tảng định giá
thật công bố, vì nó trả lời đúng câu người dùng hỏi: "con số này đáng tin tới đâu?"

**Luôn trả về khoảng tin cậy, không bao giờ trả về một con số trần trụi.** Người đọc mặc
định coi một con số đơn lẻ là chính xác tới từng đồng, trong khi mô hình có sai số điển hình
cỡ chục phần trăm. Kết quả cũng được làm tròn tới triệu đồng — hiển thị "4.237.891.523 đồng"
là nói dối bằng cách trình bày.

**Khu vực ít dữ liệu bị đánh dấu là kém tin cậy.** Một quận chỉ có vài chục tin trong dữ
liệu huấn luyện thì con số trả về phải kèm cảnh báo, chứ không im lặng như mọi quận khác.

## Chỉ số giá theo tuần (Luồng C)

Chỉ số **hedonic**, không phải trung vị giá theo tuần. Đây là khác biệt cốt lõi.

Cách hiển nhiên — lấy trung vị giá mỗi m² từng tuần rồi vẽ lên — sai theo kiểu rất khó nhận
ra, vì đường biểu đồ trông vẫn hợp lý. Vấn đề là **thay đổi cơ cấu**: tuần này ngẫu nhiên có
nhiều tin ở quận đắt hơn, trung vị nhảy lên; tuần sau nhiều tin ở quận rẻ, nó rơi xuống.
Không căn nhà nào đổi giá cả. Chỉ số như vậy đo hoạt động đăng tin, không đo thị trường.

Cách đúng là hồi quy log(giá) theo đặc điểm bất động sản **cộng các biến giả tuần**:

    log(P_i) = α + Σ β_k · X_ik + Σ δ_t · D_it + ε_i

Hệ số `δ_t` chính là chỉ số — phần biến động còn lại sau khi đã trừ ảnh hưởng của quận,
diện tích, loại hình, số phòng. Đây là phương pháp chuẩn của các cơ quan thống kê khi dựng
chỉ số giá nhà.

**Đo được trên dữ liệu thật:** trung vị thô dao động tuần 4,23 điểm, hedonic chỉ 2,36 —
**thô nhiễu gấp 1,79 lần**. Hai đường lệch nhau trung bình 2,21 điểm, lớn nhất 4,81 điểm, và
toàn bộ phần lệch đó là biến động giả do đổi cơ cấu tin đăng. Giao diện có nút bật đường
trung vị thô lên để người xem thấy tận mắt.

**Về dự báo:** 19 tuần là quá ít để dự báo tử tế. Phần dự báo vẫn được dựng nhưng theo cách
trung thực: ba phương pháp đơn giản (kể cả mô hình ngây thơ "tuần tới = tuần này"), chọn
bằng kiểm tra lùi, và nếu sai số vượt ngưỡng thì trả về `reliable: false` để giao diện nói
thẳng là chưa dự báo được — thay vì trưng một con số trông chắc chắn.

## Kiểm thử

```bash
.venv/Scripts/python.exe -m pytest -q
```

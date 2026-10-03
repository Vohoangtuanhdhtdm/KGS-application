# Đánh giá trợ lý tìm nhà

Đo độ chính xác khi trợ lý dịch một câu tiếng Việt thành bộ lọc tìm kiếm.

- `cases.json` — 43 câu hỏi có đáp án: thuê và mua, mọi loại hình (phòng trọ, căn hộ, nhà phố,
  đất, biệt thự, văn phòng, mặt bằng, kho), giá kiểu "dưới / trên / khoảng / 2tr5 / 15 tỏi",
  pháp lý, hướng, mặt tiền, điểm neo theo thời gian đi lại hoặc bán kính, khu vực chưa có tin,
  câu điều chỉnh nối tiếp ("rẻ hơn chút", "bỏ điều kiện hướng") và câu không có điều kiện nào.
- `run_eval.py` — gọi đúng endpoint thật `POST /api/assistant/search-intent` (prompt → Groq →
  tầng kiểm tra phía máy chủ), chấm điểm và ghi `results.md` / `results.json`.
- `results_v1_truoc_khi_sua.*` — kết quả lần đầu, trước khi thêm các quy tắc sửa lỗi có quy
  luật của mô hình. Giữ lại để so sánh trước/sau.

## Chạy

```bash
# API ở chế độ Development (cho phép ?model=) và nới giới hạn tần suất của trợ lý
ASPNETCORE_ENVIRONMENT=Development RateLimits__Assistant=2000 \
  dotnet run --project ../../kgs-api --urls https://localhost:7230

python run_eval.py --api https://localhost:7230 --models openai/gpt-oss-120b qwen/qwen3.8-27b
```

Mỗi mô hình chạy trên một luồng riêng (hạn mức Groq tính riêng cho từng mô hình). Gặp 429/503
(hết hạn mức token/phút) thì tự chờ rồi thử lại.

## Chỉ số

| Chỉ số | Ý nghĩa |
|---|---|
| Khớp hoàn toàn | Mọi điều kiện cứng đúng **và** không bịa thêm điều kiện nào |
| Precision | Trong các điều kiện trợ lý đặt ra, bao nhiêu là đúng. Thấp = bịa điều kiện → âm thầm loại những căn phù hợp (lỗi nguy hiểm hơn) |
| Recall | Trong các điều kiện người dùng nói, bao nhiêu được hiểu |
| Mong muốn mềm | Tỉ lệ mong muốn ("yên tĩnh", "ban công") được nhận ra |
| Điểm neo | Có/không, số phút, cách đi, bán kính |
| Báo khu vực lạ | Khu vực chưa có tin được báo lại thay vì bị lọc bừa |

Số tiền so với sai số 3% (câu "rẻ hơn chút": 10%). Bỏ qua trường thành phố vì dữ liệu hiện lưu
cùng một thành phố bằng hai cách viết; trường quận đủ cụ thể để chấm.

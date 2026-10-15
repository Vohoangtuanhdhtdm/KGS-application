# Notebook trình bày hai mô-đun học máy

Hai notebook chạy lại **từng bước** quy trình của `ml-service`, in kết quả mỗi giai đoạn, rồi
mô phỏng luồng tích hợp từ người dùng tới mô hình. Mã chép nguyên logic của `app/` và
`training/`, nên kết quả khớp với mô hình đang phục vụ.

| Notebook | Nội dung | Chạy trên Colab |
|---|---|---|
| `01_mo_hinh_dinh_gia_AVM.ipynb` | Tải dữ liệu → làm sạch → đặc trưng → chia theo thời gian → 3 mô hình nền → LightGBM (kết quả theo từng giai đoạn) → phân tích sai số → hiệu chỉnh khoảng conformal → lưu mô hình → phục vụ → luồng React → .NET → FastAPI | ~10–20 phút |
| `02_chi_so_gia_hedonic.ipynb` | Gom tuần → chỉ số trung vị thô → bằng chứng thay đổi cơ cấu → hồi quy hedonic → so sánh → 20 chỉ số quận → dự báo và kiểm tra lùi → lưu → luồng phục vụ | ~5–10 phút |

## Mở trên Google Colab

1. Vào <https://colab.research.google.com> → **Tải lên** (Upload) → chọn tệp `.ipynb`.
2. **Runtime → Run all**, hoặc chạy từng ô bằng Shift + Enter.
3. Dữ liệu (~500 MB, 3 phần đầu của bộ `tinixai/vietnam-real-estates`) được tải về thư mục
   `kgs_data/` ở ô đầu. Chạy notebook 2 sau notebook 1 trong **cùng một phiên** thì không phải tải lại.

Tệp đã lưu sẵn kết quả của một lần chạy đầy đủ (14/10/2026), nên mở ra là xem được ngay,
chưa cần chạy.

## Dùng kết quả cho dịch vụ

Bước "Lưu" của mỗi notebook ghi ra đúng định dạng dịch vụ đang dùng (`avm.*`,
`price_index.json`). Chép vào `ml-service/models/` rồi khởi động lại dịch vụ là xong.

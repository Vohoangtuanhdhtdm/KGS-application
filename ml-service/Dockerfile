# Dịch vụ định giá (AVM) — FastAPI + LightGBM.
#
# Ảnh KHÔNG chứa mô hình. Thư mục models/ bị .gitignore loại khỏi kho mã (mô hình nặng 39 MB
# và là hiện vật huấn luyện, không phải mã nguồn), nên nó được nạp vào lúc chạy qua một
# volume gắn từ máy chủ — EC2 tải từ S3 bằng quyền của IAM instance role rồi gắn read-only.
#
# Ba cái lợi của cách này so với đóng mô hình vào ảnh:
#   1. Ảnh nhẹ hơn 39 MB và không phải dựng lại chỉ vì huấn luyện lại mô hình.
#   2. Trong ảnh không có thông tin đăng nhập AWS nào — container không tự gọi S3.
#   3. Triển khai lại mã không kéo theo tải lại mô hình.

FROM python:3.12-slim

# PYTHONDONTWRITEBYTECODE: không ghi .pyc vào lớp ảnh (vô dụng, chỉ làm nặng).
# PYTHONUNBUFFERED: log ra ngay thay vì nằm trong bộ đệm — mất log là mất luôn manh mối
# khi container chết trong lúc khởi động.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# libgomp1 là thư viện OpenMP mà LightGBM liên kết động tới. Thiếu nó thì `import lightgbm`
# ném OSError ngay lúc nạp — và lỗi đó chỉ lộ ra lúc chạy, không lộ lúc build.
# curl dùng cho HEALTHCHECK bên dưới.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài phụ thuộc TRƯỚC khi chép mã nguồn: lớp này chỉ dựng lại khi requirements.txt đổi,
# nên sửa một dòng trong app/ không kéo theo mười phút cài lại numpy/scipy/lightgbm.
COPY requirements.txt ./
RUN grep -vE '^\s*pytest' requirements.txt > /tmp/requirements-prod.txt \
    && pip install --no-cache-dir -r /tmp/requirements-prod.txt \
    && rm /tmp/requirements-prod.txt

COPY app/ ./app/

# Chạy bằng người dùng thường, không phải root. Thư mục models/ được tạo sẵn để điểm gắn
# volume có chủ sở hữu đúng ngay cả khi máy chủ gắn vào một thư mục rỗng.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/models \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# /health luôn trả 200 kể cả khi chưa có mô hình — nó nói rõ model_loaded=false thay vì
# chết hẳn. Vì vậy healthcheck ở đây kiểm tra "tiến trình còn sống và phục vụ được HTTP",
# còn việc mô hình đã nạp hay chưa thì đọc trong phần thân phản hồi.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Một worker là đủ và là lựa chọn bắt buộc trên máy nhỏ: mỗi worker nạp một bản sao riêng
# của booster LightGBM vào bộ nhớ, nên hai worker là hai lần dung lượng đó.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

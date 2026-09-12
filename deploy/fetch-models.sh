#!/usr/bin/env bash
#
# Đồng bộ hiện vật mô hình định giá từ S3 về máy chủ, để container ml gắn vào chỉ-đọc.
#
# Vì sao mô hình không nằm trong ảnh Docker: nó là hiện vật huấn luyện (39 MB) và bị
# .gitignore loại khỏi kho mã, nên bản dựng trên GitHub Actions không có gì để đóng vào.
# Tách ra còn hai cái lợi: huấn luyện lại không cần dựng lại ảnh, và triển khai lại mã
# không kéo theo tải lại 39 MB.
#
# Quyền truy cập lấy từ vai trò IAM gắn vào chính máy EC2 — không có khoá AWS nào nằm trên
# đĩa, và container cũng không cần biết gì về S3.

set -euo pipefail

BUCKET="${KGS_MODELS_BUCKET:-}"
DEST=/opt/kgs/models

if [[ -z "${BUCKET}" ]]; then
  # Đọc từ .env nếu biến chưa được đặt sẵn trong môi trường.
  if [[ -f /opt/kgs/.env ]]; then
    BUCKET="$(grep -E '^KGS_MODELS_BUCKET=' /opt/kgs/.env | cut -d= -f2- || true)"
  fi
fi

if [[ -z "${BUCKET}" ]]; then
  echo "LỖI: chưa có KGS_MODELS_BUCKET. Đặt tham số /kgs/prod/KGS_MODELS_BUCKET trong" \
       "SSM Parameter Store." >&2
  exit 1
fi

mkdir -p "${DEST}"

echo "==> Đồng bộ mô hình từ s3://${BUCKET}/models/"
# --exact-timestamps: mặc định aws s3 sync chỉ tải lại khi tệp nguồn MỚI HƠN. Nếu huấn
# luyện lại cho ra tệp cùng kích thước với dấu thời gian cũ hơn (khôi phục từ bản sao lưu,
# chẳng hạn), bản mới sẽ bị bỏ qua trong im lặng.
aws s3 sync "s3://${BUCKET}/models/" "${DEST}/" --exact-timestamps --delete

# Kiểm tra hiện vật bắt buộc. Thiếu avm.txt thì dịch vụ vẫn khởi động được — nó được thiết
# kế để sống sót khi không có mô hình — nhưng mọi yêu cầu định giá sẽ trả 503 mà không ai
# biết vì sao. Thà dừng ở đây với một câu nói rõ.
for f in avm.txt avm.meta.joblib; do
  if [[ ! -s "${DEST}/${f}" ]]; then
    echo "LỖI: thiếu ${DEST}/${f}. Hãy tải hiện vật huấn luyện lên s3://${BUCKET}/models/" >&2
    exit 1
  fi
done

# Container ml chạy bằng người dùng uid 10001 (xem ml-service/Dockerfile) và chỉ cần đọc.
chmod -R a+rX "${DEST}"

echo "==> Đã đồng bộ $(ls -1 "${DEST}" | wc -l) tệp:"
ls -lh "${DEST}"

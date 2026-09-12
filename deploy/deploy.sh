#!/usr/bin/env bash
#
# Chạy TRÊN EC2, được gọi từ GitHub Actions qua AWS Systems Manager Run Command.
#
# Vì sao qua SSM chứ không phải SSH: SSH đòi mở cổng 22 ra internet và cất một khoá riêng
# trong GitHub Secrets. SSM không mở cổng nào — tác nhân trên máy chủ tự gọi ra ngoài — và
# quyền được cấp qua vai trò IAM tạm thời thay vì một khoá sống mãi.
#
#   Dùng: deploy.sh <API_IMAGE> <ML_IMAGE>

set -euo pipefail

API_IMAGE="${1:?thiếu tham số API_IMAGE}"
ML_IMAGE="${2:?thiếu tham số ML_IMAGE}"

APP_DIR=/opt/kgs
REGION="$(curl -fsS http://169.254.169.254/latest/meta-data/placement/region \
  -H "X-aws-ec2-metadata-token: $(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')")"

echo "==> Triển khai vào ${APP_DIR} (vùng ${REGION})"
cd "${APP_DIR}"

# ---------------------------------------------------------------------------
# 1. Dựng lại tệp .env từ Parameter Store
# ---------------------------------------------------------------------------
# Bí mật sống ở SSM, không ở đây và không ở kho mã. Dựng lại mỗi lần triển khai để đổi một
# tham số trong AWS là đủ — không phải nhớ đăng nhập vào máy sửa tay.
#
# --with-decryption giải mã các tham số kiểu SecureString bằng khoá KMS mặc định.
echo "==> Nạp cấu hình từ SSM Parameter Store"
umask 077   # .env chỉ chủ sở hữu đọc được, đặt TRƯỚC khi tệp được tạo

aws ssm get-parameters-by-path \
  --path "/kgs/prod" \
  --recursive \
  --with-decryption \
  --region "${REGION}" \
  --query "Parameters[].[Name,Value]" \
  --output text \
  | while IFS=$'\t' read -r name value; do
      # /kgs/prod/ConnectionStrings__PostgresDb  ->  ConnectionStrings__PostgresDb
      echo "${name##*/}=${value}"
    done > "${APP_DIR}/.env.new"

if [[ ! -s "${APP_DIR}/.env.new" ]]; then
  echo "LỖI: không đọc được tham số nào từ /kgs/prod. Dừng để không khởi động lại dịch vụ" \
       "bằng một cấu hình rỗng." >&2
  rm -f "${APP_DIR}/.env.new"
  exit 1
fi

mv "${APP_DIR}/.env.new" "${APP_DIR}/.env"

# ---------------------------------------------------------------------------
# 2. Đồng bộ mô hình định giá từ S3
# ---------------------------------------------------------------------------
"${APP_DIR}/fetch-models.sh"

# ---------------------------------------------------------------------------
# 3. Kéo ảnh mới và thay thế
# ---------------------------------------------------------------------------
export API_IMAGE ML_IMAGE

echo "==> Kéo ảnh"
docker compose pull

echo "==> Khởi động lại dịch vụ"
docker compose up -d --remove-orphans

# ---------------------------------------------------------------------------
# 4. Xác minh — triển khai chỉ được coi là xong khi API thực sự trả lời
# ---------------------------------------------------------------------------
# Không có bước này thì "triển khai thành công" chỉ có nghĩa là docker nhận lệnh, kể cả khi
# container chết ngay sau đó vì sai chuỗi kết nối. Bản dựng sẽ báo xanh còn hệ thống thì sập.
echo "==> Chờ API trả lời /health"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://localhost/health > /dev/null 2>&1; then
    echo "==> API đã sẵn sàng sau ${i} lần thử."

    echo "==> Dọn ảnh cũ"
    docker image prune -af --filter "until=168h" || true

    echo "==> TRIỂN KHAI THÀNH CÔNG"
    exit 0
  fi
  sleep 5
done

echo "LỖI: API không trả lời /health sau 150 giây. Nhật ký gần nhất:" >&2
docker compose logs --tail 80 api >&2
exit 1

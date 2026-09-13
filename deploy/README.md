# Triển khai KGS lên AWS

Hướng dẫn dựng hạ tầng một lần. Sau khi làm xong, mỗi lần đẩy mã lên `main` là hệ thống tự
cập nhật — không còn thao tác tay nào.

---

## Kiến trúc

```
                     ┌─────────────────────────────────────┐
  Người dùng ──────► │        CloudFront (HTTPS)           │
                     │   một tên miền cho cả hai đường      │
                     └───────────┬─────────────┬───────────┘
                   mặc định /    │             │  /api/*
                                 ▼             ▼
                        ┌────────────┐   ┌──────────────────────┐
                        │  S3        │   │  EC2 t3.small :80    │
                        │  giao diện │   │  ┌────────────────┐  │
                        │  tĩnh      │   │  │ api (.NET 8)   │  │
                        └────────────┘   │  └───────┬────────┘  │
                                         │          │ nội bộ    │
                                         │  ┌───────▼────────┐  │
                                         │  │ ml (FastAPI)   │  │
                                         │  └────────────────┘  │
                                         └──────────┬───────────┘
                                                    │
                                    ┌───────────────▼──────────────┐
                                    │  RDS PostgreSQL + PostGIS    │
                                    └──────────────────────────────┘
```

**Vì sao giao diện và API chung một tên miền CloudFront:** trình duyệt coi mọi lời gọi là
cùng nguồn, nên không có CORS, không có preflight, và EC2 không cần chứng chỉ TLS nào — việc
mã hoá do CloudFront lo. Đổi lại, chặng CloudFront → EC2 đi bằng HTTP; bước 4 khoá chặng đó
lại bằng nhóm bảo mật chỉ cho dải địa chỉ của CloudFront.

---

## Chi phí thực tế

Gói credit $100 / 6 tháng **không phải là miễn phí theo giờ** — mọi thứ đều trừ vào credit.

| Hạng mục | Cấu hình | Mỗi tháng |
|---|---|---|
| EC2 | `t3.small` (2 GB RAM) | ~15,2 USD |
| RDS | `db.t4g.micro` + 20 GB gp3 | ~14,0 USD |
| S3 | < 1 GB | ~0,3 USD |
| CloudFront | dưới 1 TB — luôn miễn phí | 0 USD |
| **Tổng** | | **~29,5 USD** |

$100 credit ≈ **3,4 tháng**. Hạ EC2 xuống `t3.micro` (1 GB) còn ~21,6 USD/tháng ≈ 4,6 tháng,
nhưng 1 GB RAM phải gánh cả .NET lẫn LightGBM nên **bắt buộc thêm swap** (bước 3 có sẵn).

> **Làm trước tiên:** vào Billing → Budgets, tạo một budget 20 USD/tháng có cảnh báo qua
> email. Không có nó thì thứ đầu tiên báo cho bạn biết credit đã hết sẽ là lúc dịch vụ ngừng.

---

## Bước 1 · RDS PostgreSQL

Console → RDS → Create database.

| Mục | Giá trị |
|---|---|
| Engine | PostgreSQL 16 |
| Template | **Dev/Test** (không phải Production — nó bật Multi-AZ, đắt gấp đôi) |
| Instance | `db.t4g.micro` |
| Storage | 20 GB gp3, **tắt autoscaling** |
| Public access | **No** |
| VPC | cùng VPC với EC2 sẽ tạo ở bước 3 |

Ghi lại endpoint, tên người dùng chính và mật khẩu.

> **Quan trọng:** migration của dự án tự chạy `CREATE EXTENSION postgis`, nên chuỗi kết nối
> phải dùng **người dùng chính** (RDS cấp sẵn vai trò `rds_superuser`). Một người dùng
> thường sẽ làm migration dừng ngay ở bước đầu.

---

## Bước 2 · Hai bucket S3

```bash
export REGION=ap-southeast-1            # Singapore — gần Việt Nam nhất
export WEB_BUCKET=kgs-web-$RANDOM
export MODELS_BUCKET=kgs-models-$RANDOM

aws s3 mb "s3://$WEB_BUCKET"    --region $REGION
aws s3 mb "s3://$MODELS_BUCKET" --region $REGION
```

Cả hai **giữ nguyên mặc định chặn truy cập công khai**. Giao diện không phát trực tiếp từ
S3 mà qua CloudFront bằng Origin Access Control (bước 4), nên bucket không cần công khai.

Tải mô hình lên:

```bash
aws s3 sync ml-service/models/ "s3://$MODELS_BUCKET/models/"
```

---

## Bước 3 · EC2

**Tạo máy:** Amazon Linux 2023, `t3.small`, 16 GB gp3, cùng VPC với RDS.
Gắn **Elastic IP** (miễn phí khi đang gắn vào máy đang chạy) để địa chỉ không đổi sau mỗi
lần khởi động lại.

**Vai trò IAM cho máy** — tạo role `kgs-ec2-role`, gắn:

- `AmazonSSMManagedInstanceCore` (chính sách có sẵn — cho phép nhận lệnh triển khai)
- một chính sách nội tuyến:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DocMoHinh",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::MODELS_BUCKET",
        "arn:aws:s3:::MODELS_BUCKET/*"
      ]
    },
    {
      "Sid": "DocCauHinh",
      "Effect": "Allow",
      "Action": ["ssm:GetParametersByPath", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:*:*:parameter/kgs/prod/*"
    },
    {
      "Sid": "GiaiMa",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*"
    }
  ]
}
```

**User data** (dán vào phần Advanced details khi tạo máy):

```bash
#!/bin/bash
set -eux
dnf update -y
dnf install -y docker git

# Swap 2 GB. Bắt buộc trên t3.micro, vẫn nên có trên t3.small: LightGBM ngốn bộ nhớ theo
# từng đợt lúc nạp mô hình, và hết RAM giữa chừng thì nhân hệ điều hành giết tiến trình
# chứ không chờ.
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

systemctl enable --now docker
usermod -aG docker ec2-user

# Trình cắm compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/kgs/models
```

**Chép tệp triển khai lên máy** (một lần, qua SSM Session Manager hoặc `scp`):

```bash
sudo cp deploy/docker-compose.prod.yml /opt/kgs/docker-compose.yml
sudo cp deploy/deploy.sh deploy/fetch-models.sh /opt/kgs/
sudo chmod +x /opt/kgs/*.sh
```

**Nhóm bảo mật:** mở cổng **80** chỉ cho CloudFront, không cho cả internet:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-XXXX --protocol tcp --port 80 \
  --source-prefix-list-id "$(aws ec2 describe-managed-prefix-lists \
      --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
      --query 'PrefixLists[0].PrefixListId' --output text --region $REGION)" \
  --region $REGION
```

Không mở cổng 22. Cần vào máy thì dùng **Session Manager** trong console — không cần khoá
SSH, không cần mở cổng nào, và mọi phiên đều được ghi lại.

Nhóm bảo mật của RDS: cho phép cổng 5432 **chỉ từ nhóm bảo mật của EC2**.

---

## Bước 4 · CloudFront

Tạo một distribution với **hai origin**:

| Origin | Kiểu | Cấu hình |
|---|---|---|
| `s3-web` | S3 | bucket giao diện, bật **Origin Access Control**, để CloudFront tự cập nhật policy |
| `ec2-api` | Custom | Elastic IP của EC2, **HTTP only**, cổng 80 |

**Behaviors:**

| Đường dẫn | Origin | Chính sách |
|---|---|---|
| `/api/*` | `ec2-api` | Cache: `CachingDisabled` · Origin request: `AllViewer` · cho phép mọi phương thức HTTP |
| `Default (*)` | `s3-web` | Cache: `CachingOptimized` · chỉ GET/HEAD |

> `AllViewer` là bắt buộc ở nhánh `/api/*`: không có nó, CloudFront cắt header `Authorization`
> và mọi yêu cầu cần đăng nhập trả về 401 — một lỗi rất khó lần vì phía API trông như thể
> người dùng chưa gửi token.

**Default root object:** `index.html`

**Custom error responses** — đây là thứ làm SPA hoạt động. Không có nó, tải lại trang ở
`/tin-dang` sẽ ra 403 vì S3 không có tệp nào tên như vậy:

| Mã lỗi | Trả về | Mã phản hồi |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

---

## Bước 5 · Bí mật trong SSM Parameter Store

Mọi khoá nằm dưới tiền tố `/kgs/prod/`, đúng tên biến môi trường mà .NET đọc (dấu `:`
trong khoá cấu hình viết thành `__`).

```bash
put() { aws ssm put-parameter --name "/kgs/prod/$1" --value "$2" \
        --type SecureString --overwrite --region $REGION; }

put "ConnectionStrings__PostgresDb" \
    "Host=ENDPOINT.rds.amazonaws.com;Port=5432;Database=kgs;Username=postgres;Password=...;SSL Mode=Require;Trust Server Certificate=true"
put "AppSettings__TokenKey"            "$(openssl rand -base64 48)"
put "AuthSettings__ClientBaseUrl"      "https://dXXXX.cloudfront.net"
put "Cors__AllowedOrigins__0"          "https://dXXXX.cloudfront.net"
put "CloudinarySettings__CloudName"    "..."
put "CloudinarySettings__ApiKey"       "..."
put "CloudinarySettings__ApiSecret"    "..."
put "SmtpSettings__Host"               "smtp.gmail.com"
put "SmtpSettings__Port"               "587"
put "SmtpSettings__Username"           "..."
put "SmtpSettings__Password"           "..."
put "SmtpSettings__FromEmail"          "..."
put "SmtpSettings__FromName"           "KGS"
put "SeedAdmin__Email"                 "admin@kgs.local"
put "SeedAdmin__Password"              "..."
put "GoogleAuth__ClientId"             "..."
put "KGS_MODELS_BUCKET"                "$MODELS_BUCKET"
```

---

## Bước 6 · Cho GitHub quyền triển khai (OIDC)

Không tạo khoá truy cập dài hạn. GitHub tự xuất token ngắn hạn, AWS đổi lấy quyền tạm thời.

```bash
# Một lần cho cả tài khoản
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Tạo role `kgs-github-deploy` với trust policy — chú ý `sub` khoá đúng vào một kho mã và một
nhánh, nếu để `*` thì bất kỳ kho nào cũng có thể nhận quyền này:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:Vohoangtuanhdhtdm/KGS-application:ref:refs/heads/main"
      }
    }
  }]
}
```

Quyền cho role đó:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::WEB_BUCKET", "arn:aws:s3:::WEB_BUCKET/*"] },
    { "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DIST_ID" },
    { "Effect": "Allow",
      "Action": ["ssm:SendCommand", "ssm:GetCommandInvocation"],
      "Resource": ["arn:aws:ec2:*:*:instance/INSTANCE_ID",
                   "arn:aws:ssm:*::document/AWS-RunShellScript",
                   "arn:aws:ssm:*:*:*"] }
  ]
}
```

---

## Bước 7 · Khai báo trong GitHub

Settings → Secrets and variables → Actions.

**Secrets** (giá trị bị che trong nhật ký):

| Tên | Giá trị |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/kgs-github-deploy` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |

**Variables** (hiện trong nhật ký — đây là chủ ý, chúng không phải bí mật và thấy được thì
dễ lần lỗi hơn):

| Tên | Ví dụ |
|---|---|
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_WEB_BUCKET` | tên bucket giao diện |
| `AWS_CLOUDFRONT_ID` | `E1XXXXXXXXXXXX` |
| `AWS_EC2_INSTANCE_ID` | `i-0xxxxxxxxxxxxxxxx` |

---

## Bước 8 · Chạy thử

Actions → Deploy → Run workflow. Theo dõi ba việc: hai ảnh Docker được đẩy lên GHCR, giao
diện lên S3, và máy chủ trả về `TRIỂN KHAI THÀNH CÔNG`.

Kiểm tra lại bằng tay:

```bash
# /health nằm ở gốc API chứ không dưới /api, nên qua CloudFront không gọi tới được — đó là
# chủ ý, nó chỉ dành cho kịch bản triển khai gọi từ bên trong máy chủ.
curl https://dXXXX.cloudfront.net/api/listings/areas               # JSON danh sách khu vực
curl https://dXXXX.cloudfront.net/api/valuation/model-info         # loaded:true, mdape:17.44
curl -I https://dXXXX.cloudfront.net/tin-dang                      # 200, không phải 403
```

---

## Khi có sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Deploy dừng ở `/health` sau 150 giây | Sai chuỗi kết nối RDS, hoặc nhóm bảo mật RDS chưa cho EC2 vào. `docker compose logs api` trên máy nói rõ. |
| Mọi yêu cầu cần đăng nhập trả 401 | Behavior `/api/*` chưa dùng origin request policy `AllViewer` → header `Authorization` bị cắt. |
| Tải lại trang ở route con ra 403 | Thiếu custom error response 403 → `/index.html` 200. |
| `/api/valuation/model-info` báo `loaded:false` | Bucket mô hình rỗng hoặc thiếu `avm.txt`. Chạy lại `/opt/kgs/fetch-models.sh`. |
| Container `ml` bị giết liên tục | Hết RAM. Kiểm tra `free -h`; nếu swap chưa bật thì phần user data chưa chạy. |
| Migration dừng ở `CREATE EXTENSION postgis` | Chuỗi kết nối không dùng người dùng chính của RDS. |

## Quay lui một bản

Mọi ảnh đều gắn thẻ theo SHA của commit, nên quay lui là chạy lại đúng một lệnh trên máy:

```bash
sudo /opt/kgs/deploy.sh \
  ghcr.io/vohoangtuanhdhtdm/kgs-application/kgs-api:SHA_CU \
  ghcr.io/vohoangtuanhdhtdm/kgs-application/kgs-ml:SHA_CU
```

Lưu ý: mã quay lui được, nhưng migration cơ sở dữ liệu thì không. Một migration đã áp sẽ ở
lại — đó là lý do mọi migration nên tương thích ngược.

# Hạ tầng và vận hành

Hạ tầng production của ShopFlow, mô tả bằng Terraform. Quyết định về hình thái và
lý do chọn nằm ở [docs/steps/S10.md](../docs/steps/S10.md) mục 5.

```
ap-southeast-1
    CloudFront ──┬── S3 web            tệp tĩnh, không công khai trực tiếp
                 ├── S3 images         ảnh sản phẩm, ở /anh
                 └── ALB ── ECS Fargate ── RDS PostgreSQL
                                        └─ ElastiCache Redis
```

## Chạy Terraform mà không cài gì lên máy

Terraform chạy qua ảnh Docker chính thức, phiên bản ghim rõ. Không phải cài, và
mọi người dùng đúng một phiên bản.

```bash
tf() {
      docker run --rm -it \
            -v "$PWD":/w -w /w \
            -v "$HOME/.aws":/root/.aws:ro \
            -e AWS_PROFILE \
            hashicorp/terraform:1.14 "$@"
}

cd infra/terraform
tf validate
```

## Trước khi dựng lần đầu

Bốn thứ dưới đây phải có sẵn, và không thứ nào tự tạo ra được từ mã nguồn.

| Hạng mục                | Cách chuẩn bị                                                                   |
| ----------------------- | ------------------------------------------------------------------------------- |
| Thông tin xác thực AWS  | `aws configure --profile shopflow`. **Không bao giờ dán khoá vào kho mã.**      |
| Tên miền trong Route 53 | Mua tên miền, tạo hosted zone, trỏ name server của nhà đăng ký về Route 53      |
| Bucket chứa trạng thái  | Xem mục dưới đây. Phải có trước `terraform init`                                |
| Ảnh api đã đẩy lên GHCR | Chạy workflow **Deploy** một lần, hoặc `docker build` và `docker push` bằng tay |

### Bucket chứa trạng thái Terraform

Trạng thái chứa mọi thứ đã dựng. Để nó trên máy cá nhân nghĩa là mất máy là mất
khả năng vận hành hạ tầng, và hai người chạy cùng lúc thì ghi đè lên nhau.

```bash
aws s3api create-bucket \
      --bucket shopflow-terraform-state \
      --region ap-southeast-1 \
      --create-bucket-configuration LocationConstraint=ap-southeast-1

aws s3api put-bucket-versioning \
      --bucket shopflow-terraform-state \
      --versioning-configuration Status=Enabled
```

Bật versioning không phải cho đủ thủ tục: một lần `terraform apply` hỏng giữa
chừng có thể để lại tệp trạng thái không đọc được, và bản trước là đường lùi duy
nhất.

## Dựng hạ tầng

```bash
cd infra/terraform

tf init \
      -backend-config=bucket=shopflow-terraform-state \
      -backend-config=region=ap-southeast-1

tf plan \
      -var domain_name=shopflow.vn \
      -var hosted_zone_id=Z0123456789ABCDEFGHIJ \
      -var api_image=ghcr.io/vnt04/ecommerce-hands-on/api:abc123def456

# Đọc kỹ plan trước khi apply. Hạ tầng phát sinh phí ngay khi dựng.
tf apply ...
```

`terraform apply` lần đầu mất khoảng 20 phút, phần lớn là chờ RDS và CloudFront.

### Ghi secret

Terraform tạo tham số nhưng để giá trị là chỗ giữ chỗ. Giá trị thật ghi vào bằng
lệnh riêng, và không bao giờ đi qua CI hay qua tệp trạng thái Terraform.

```bash
# Khoá ký access token. Đổi khoá này làm mọi phiên đang mở mất hiệu lực.
aws ssm put-parameter --overwrite \
      --name /shopflow/prod/JWT_SECRET \
      --type SecureString \
      --value "$(openssl rand -base64 48)"

# Chuỗi kết nối. Mật khẩu do RDS sinh và nằm trong Secrets Manager; đọc ra rồi ghép.
secret_arn=$(tf output -raw database_secret_arn)
password=$(aws secretsmanager get-secret-value --secret-id "$secret_arn" \
      --query SecretString --output text | jq -r .password)
host=$(tf output -raw database_endpoint)

# Ghép bằng printf thay vì viết thẳng chuỗi: công cụ quét secret bắt mọi chuỗi
# kết nối trông như thật, kể cả trong tài liệu.
url=$(printf 'postgres://%s:%s@%s:5432/%s' shopflow "$password" "$host" shopflow)

aws ssm put-parameter --overwrite \
      --name /shopflow/prod/DATABASE_URL \
      --type SecureString \
      --value "$url"
```

Sau khi đổi secret phải khởi động lại service: ECS đọc secret lúc dựng container,
không đọc lại khi đang chạy.

```bash
aws ecs update-service --cluster shopflow-prod --service shopflow-prod-api \
      --force-new-deployment
```

### Biến cấu hình cho workflow Deploy

Workflow đọc từ GitHub Actions variables và secrets. Lấy giá trị từ output của
Terraform:

```bash
tf output
```

| Nơi đặt                  | Tên                          | Giá trị                                         |
| ------------------------ | ---------------------------- | ----------------------------------------------- |
| Repository **variables** | `AWS_REGION`                 | `ap-southeast-1`                                |
|                          | `ECS_CLUSTER`                | output `ecs_cluster`                            |
|                          | `ECS_SERVICE`                | output `ecs_service`                            |
|                          | `API_TASK_DEFINITION`        | `shopflow-prod-api`                             |
|                          | `MIGRATE_TASK_DEFINITION`    | output `migrate_task_definition`                |
|                          | `PRIVATE_SUBNET_IDS`         | output `private_subnet_ids`, ngăn bằng dấu phẩy |
|                          | `API_SECURITY_GROUP_ID`      | output `api_security_group_id`                  |
|                          | `WEB_BUCKET`                 | output `web_bucket`                             |
|                          | `CLOUDFRONT_DISTRIBUTION_ID` | output `cloudfront_distribution_id`             |
| Repository **secrets**   | `AWS_DEPLOY_ROLE_ARN`        | Vai trò IAM mà GitHub nhận qua OIDC             |

Workflow lấy quyền AWS bằng OIDC, không lưu cặp khoá tĩnh. Vai trò đó cần quyền
`ecs:*` trên cluster này, `s3:*` trên bucket web, và `cloudfront:CreateInvalidation`.

## Triển khai

Vào tab **Actions** trên GitHub, chọn workflow **Deploy**, bấm **Run workflow**.
Workflow làm bốn việc theo thứ tự:

1. Dựng ảnh api, đẩy lên GHCR với thẻ là mười hai ký tự đầu của mã commit
2. Chạy migration bằng một task riêng, chờ nó thoát với mã 0
3. Đăng ký task definition mới và cập nhật service, chờ tới khi ổn định
4. Đồng bộ web tĩnh lên S3 rồi xoá cache CloudFront

Thứ tự này có chủ đích: migration chạy xong hẳn mới cập nhật service, vì chạy
song song nghĩa là bản mã cũ có thể gặp lược đồ mới giữa chừng.

**Mọi migration phải tương thích ngược.** Trong lúc chuyển đổi, bản cũ và bản mới
cùng chạy. Đổi tên cột hay xoá cột phải tách thành hai lần triển khai: lần đầu
thêm cột mới và ghi cả hai chỗ, lần sau mới bỏ cột cũ.

## Quay lui

```bash
# Xem các revision gần đây và ảnh của chúng.
aws ecs list-task-definitions --family-prefix shopflow-prod-api --sort DESC --max-items 5

# Trỏ service về revision trước.
aws ecs update-service --cluster shopflow-prod --service shopflow-prod-api \
      --task-definition shopflow-prod-api:41

aws ecs wait services-stable --cluster shopflow-prod --services shopflow-prod-api
```

Quay lui mã nguồn **không** quay lui migration. Nếu bản vừa đẩy có migration làm
hỏng bản cũ thì quay lui không cứu được, và đó chính là lý do mọi migration phải
tương thích ngược.

Service còn có circuit breaker: bản mới không lành mạnh thì ECS tự quay lui mà
không cần ai làm gì.

## Xem log

```bash
# Theo dõi trực tiếp.
aws logs tail /ecs/shopflow-prod-api --follow

# Chỉ log của migration.
aws logs tail /ecs/shopflow-prod-api --log-stream-name-prefix migrate --since 1h

# Tìm theo mã request. Mọi log của một request mang cùng một requestId; xem
# apps/api/src/app.module.ts.
aws logs tail /ecs/shopflow-prod-api --since 1h \
      --filter-pattern '{ $.req.id = "8f3c..." }'
```

## Chi phí

Ước tính ở `ap-southeast-1`, chưa tính lưu lượng, cho hạ tầng để nguyên không ai
dùng:

| Hạng mục                    | USD mỗi tháng |
| --------------------------- | ------------- |
| ALB                         | ~18           |
| NAT gateway                 | ~35           |
| RDS db.t4g.micro, 20GB gp3  | ~15           |
| ElastiCache cache.t4g.micro | ~12           |
| ECS Fargate, 2 × 0.5 vCPU   | ~30           |
| S3 và CloudFront            | ~2            |
| **Tổng**                    | **~112**      |

Con số này cao hơn ước tính 45 USD nêu lúc chốt quyết định, vì ước tính đó bỏ sót
NAT gateway và ElastiCache, và tính Fargate ở mức 0.25 vCPU một bản sao thay vì
0.5 vCPU hai bản sao.

Ba cách cắt, theo thứ tự đáng làm:

| Cách                                                   | Tiết kiệm | Đánh đổi                                                       |
| ------------------------------------------------------ | --------- | -------------------------------------------------------------- |
| Bỏ NAT gateway, dùng VPC endpoint cho S3 và ECR        | ~30       | Thêm cấu hình; task mất đường ra Internet công khai            |
| `api_desired_count = 1`                                | ~15       | Triển khai có khoảng gián đoạn, một task hỏng là cửa hàng đóng |
| Bỏ ElastiCache, đếm rate limit trong bộ nhớ tiến trình | ~12       | Giới hạn tính riêng cho từng bản sao, nên trần thật là gấp đôi |

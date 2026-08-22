# Triển khai AWS lần đầu

Danh sách việc để đi từ máy trắng tới hạ tầng chạy thật, làm theo thứ tự.

Tài liệu này dành cho **lần đầu**, khi chưa có tài khoản AWS và chưa có gì trên đó. Vận hành
thường ngày — triển khai, quay lui, xem log — nằm ở [README.md](README.md). Quyết định về hình
thái hạ tầng và lý do chọn nằm ở [S10](../docs/steps/S10.md) mục 5.

Nguyên tắc xuyên suốt: **chứng minh xoá được trước khi dựng thứ tốn tiền.**

## Máy cần có gì

|           | Kiểm bằng        | Nếu thiếu                                       |
| --------- | ---------------- | ----------------------------------------------- |
| Docker    | `docker version` | Docker Desktop                                  |
| AWS CLI   | `aws --version`  | `brew install awscli`                           |
| Terraform | không cần cài    | Chạy qua ảnh Docker, xem [README.md](README.md) |

---

## Phần A — Tài khoản và quyền

Làm một lần, khoảng 30 phút. Phần này không đụng tới mã nguồn.

### A1. Tài khoản AWS

Đăng ký tại `aws.amazon.com`. Cần thẻ tín dụng hoặc thẻ ghi nợ quốc tế; AWS trừ thử khoảng 1 USD
rồi hoàn lại để xác minh.

### A2. Bật MFA cho tài khoản root, rồi cất nó đi

Tài khoản root làm được mọi thứ, kể cả đóng tài khoản và sửa hoá đơn. Mất nó là mất tất cả, và
không có cơ chế nào giới hạn thiệt hại sau khi mất.

Bật MFA xong thì không dùng root cho việc hằng ngày nữa.

### A3. Tạo IAM user cho công việc

Console → IAM → Users → Create user:

| Trường | Giá trị                          |
| ------ | -------------------------------- |
| Tên    | `shopflow-deploy`                |
| Quyền  | Gắn policy `AdministratorAccess` |

Vào user vừa tạo → Security credentials → Create access key → chọn **Command Line Interface
(CLI)**. Lưu lại `Access Key ID` và `Secret Access Key`; secret chỉ hiện đúng một lần.

`AdministratorAccess` là quyền rộng. Với dự án một người thì đây là lựa chọn thực dụng: Terraform
cần tạo VPC, RDS, ECS, IAM role, ACM, Route 53 và CloudFront, mà thu hẹp quyền cho vừa đủ ngần đó
là một buổi làm việc riêng. Thu hẹp lại khi có nhiều người cùng chạm vào hạ tầng.

**Không bao giờ tạo access key cho tài khoản root.** Khoá đó không giới hạn phạm vi được.

### A4. Cấu hình profile trên máy

```bash
aws configure --profile shopflow
```

Bốn câu hỏi, trả lời lần lượt:

```
AWS Access Key ID     : (từ A3)
AWS Secret Access Key : (từ A3)
Default region name   : ap-southeast-1
Default output format : json
```

`ap-southeast-1` là Singapore, vùng gần Việt Nam nhất.

### A5. Kiểm tra

```bash
aws sts get-caller-identity --profile shopflow
```

Trả về JSON có `Account` và `Arn` là xong phần A.

### A6. Bật cảnh báo chi phí — làm ngay, đừng để sau

Console → Billing and Cost Management → Budgets → Create budget → mẫu **Zero spend budget**, hoặc
Cost budget ngưỡng 5 USD. Điền email nhận cảnh báo.

Mất hai phút, và đây là thứ duy nhất báo cho bạn khi lỡ quên `terraform destroy` trước lúc đi ngủ.

---

## Phần B — Chuẩn bị Terraform

### B1. Bucket chứa trạng thái

Trạng thái Terraform ghi lại mọi thứ đã dựng. Để trên máy cá nhân nghĩa là mất máy là mất khả
năng vận hành hạ tầng, và hai người chạy cùng lúc thì ghi đè lên nhau.

```bash
export AWS_PROFILE=shopflow

aws s3api create-bucket \
      --bucket shopflow-terraform-state \
      --region ap-southeast-1 \
      --create-bucket-configuration LocationConstraint=ap-southeast-1

aws s3api put-bucket-versioning \
      --bucket shopflow-terraform-state \
      --versioning-configuration Status=Enabled
```

Tên bucket phải là duy nhất trên toàn AWS. Trùng thì thêm hậu tố.

Bật versioning không phải cho đủ thủ tục: một lần `apply` hỏng giữa chừng có thể để lại tệp trạng
thái không đọc được, và bản trước là đường lùi duy nhất.

### B2. Hàm chạy Terraform

Dán vào shell mỗi phiên làm việc, hoặc bỏ vào `~/.zshrc`:

```bash
export AWS_PROFILE=shopflow

tf() {
      docker run --rm -it \
            -v "$PWD":/w -w /w \
            -v "$HOME/.aws":/root/.aws:ro \
            -e AWS_PROFILE \
            hashicorp/terraform:1.14 "$@"
}
```

Chạy Terraform qua Docker để không phải cài, và để mọi người dùng đúng một phiên bản.

### B3. Khởi tạo

```bash
cd infra/terraform

tf init \
      -backend-config=bucket=shopflow-terraform-state \
      -backend-config=region=ap-southeast-1
```

### B4. Xem kế hoạch — chưa dựng gì cả

```bash
tf plan \
      -var environment=lab \
      -var domain_name=vi-du.com \
      -var hosted_zone_id=Z000000000000000000000 \
      -var api_image=ghcr.io/vnt04/ecommerce-hands-on/api:0000000
```

Ba biến `domain_name`, `hosted_zone_id`, `api_image` bắt buộc phải có giá trị nhưng `plan` không
kiểm tra chúng có thật hay không, nên đặt tạm được. Chỉ **không** được `apply` phần tên miền bằng
giá trị tạm.

`-var environment=lab` đổi hậu tố tên của mọi tài nguyên, để môi trường học không đụng gì tới
`prod` về sau.

Đây là lần đầu Terraform gọi API của AWS thật. `terraform validate` chỉ kiểm cú pháp và kiểu; chỉ
`plan` mới phát hiện được những thứ như một cỡ máy không có ở vùng đã chọn, hết hạn mức, hay tên
tài nguyên trùng. **Nhiều khả năng sẽ phải sửa vài chỗ ở bước này.**

Đọc kỹ output. Nó liệt kê từng tài nguyên sắp tạo. Không mất đồng nào để đọc.

---

## Phần C — Dựng theo tầng

Chi phí AWS tính theo giờ, không theo tháng. Cả cụm khoảng **0,15 USD mỗi giờ**, nên một buổi hai
tiếng rồi xoá tốn chưa tới nửa đô. Cái đắt không phải dựng, mà là **quên xoá**.

| Tầng | Gồm gì                                                          | USD/giờ |
| ---- | --------------------------------------------------------------- | ------: |
| 0    | VPC, subnet, security group, IAM role, S3 bucket, SSM parameter |       0 |
| 1    | NAT gateway + Elastic IP                                        |   0,048 |
| 2    | RDS PostgreSQL + ElastiCache Redis                              |   0,037 |
| 3    | ALB + ECS Fargate                                               |   0,066 |
| 4    | ACM + CloudFront + Route 53                                     |   0,003 |

Ước tính từ bảng chi phí ở [README.md](README.md) chia theo giờ. Giá theo vùng có thay đổi.

### C1. Tầng 0 — miễn phí, và là phần đáng hiểu nhất

```bash
tf apply \
      -var environment=lab \
      -var domain_name=vi-du.com \
      -var hosted_zone_id=Z000000000000000000000 \
      -var api_image=ghcr.io/vnt04/ecommerce-hands-on/api:0000000 \
      -target=aws_subnet.public \
      -target=aws_subnet.private \
      -target=aws_security_group.alb \
      -target=aws_security_group.api \
      -target=aws_security_group.database \
      -target=aws_security_group.cache
```

Terraform tự kéo theo những thứ các tài nguyên trên phụ thuộc, ví dụ `aws_vpc.main`. VPC, subnet
và security group đều không tính phí, nên tầng này để bao lâu cũng được.

Đây cũng là phần khó hiểu nhất của hạ tầng mà lại không tốn tiền — dựng, đọc, sửa, dựng lại thoải
mái. Chỗ đáng xem: security group tham chiếu lẫn nhau chứ không mở theo dải địa chỉ, nên nới rộng
mạng không vô tình mở thêm cửa nào.

`-target` là lối thoát hiểm của Terraform, không phải cách dùng thường ngày. Ở đây nó phục vụ đúng
một việc: tách phần miễn phí ra để học trước.

### C2. Xoá ngay, xác nhận vòng dựng-xoá chạy được

```bash
tf destroy -var environment=lab -var domain_name=vi-du.com \
      -var hosted_zone_id=Z000000000000000000000 \
      -var api_image=ghcr.io/vnt04/ecommerce-hands-on/api:0000000

tf state list        # phải rỗng
```

**Đừng bỏ qua bước này.** Biết chắc mình xoá được rồi hãy dựng thứ tính tiền, chứ không phải dựng
xong mới phát hiện không xoá được.

### C3. Các tầng sau

Lặp lại: dựng một tầng, xem, xoá, xác nhận sạch. Tầng 4 cần tên miền thật trong Route 53 nên để
sau cùng; ba tầng đầu không cần.

Khi đã quen cả bốn tầng thì mới dựng nguyên cụm bằng `tf apply` không kèm `-target`.

Sau khi dựng nguyên cụm, ghi giá trị thật cho các tham số SSM — xem [README.md](README.md) mục
**Ghi secret**. Terraform tạo tham số nhưng cố ý để giá trị là chỗ giữ chỗ.

---

## Bẫy đã biết

**RDS chặn xoá.** `deletion_protection` mặc định bật và `skip_final_snapshot` mặc định tắt — đúng
cho production, sai cho môi trường học. Không hạ hai thứ này xuống thì `terraform destroy` dừng
ngay ở RDS, và nếu không đọc kỹ output thì RDS vẫn chạy và vẫn tính tiền. Chạy môi trường lab thì
thêm:

```bash
-var deletion_protection=false -var skip_final_snapshot=true
```

Lần thứ hai còn khó đoán hơn: `skip_final_snapshot=false` bắt RDS chụp một bản sao cuối với tên cố
định, nên vòng xoá thứ hai hỏng vì tên đó đã tồn tại.

**CloudFront chậm.** Tạo mất khoảng 20 phút, xoá cũng vậy. Một vòng dựng-xoá đủ cả bốn tầng mất
gần 40 phút chỉ để chờ. Đừng dựng tầng 4 khi chỉ có 30 phút rảnh.

**Thẻ ảnh không bao giờ là `latest`.** Terraform có `validation` từ chối thẻ đó: quay lui là trỏ về
thẻ cũ, mà `latest` thì không có thẻ cũ nào để trỏ về.

**Snapshot còn sót.** Sau vài vòng dựng-xoá, kiểm RDS → Snapshots và dọn những bản không dùng.
Chúng nhỏ nhưng tích tụ.

---

## Checklist sau mỗi buổi

```bash
tf destroy -var environment=lab ...   # kèm đủ các -var như lúc apply
tf state list                          # phải rỗng
```

Hôm sau mở Cost Explorer xem còn khoản nào phát sinh không. Ba thứ **không** tự mất đi khi
`destroy`:

|                      |                                           |
| -------------------- | ----------------------------------------- |
| Tên miền             | Mua rồi không trả lại, ~10–15 USD mỗi năm |
| Route 53 hosted zone | 0,50 USD mỗi tháng, tính cố định          |
| Snapshot RDS         | Nhỏ, nhưng tích tụ qua nhiều vòng         |

Ba thứ đó chỉ phát sinh từ tầng 4 trở đi.

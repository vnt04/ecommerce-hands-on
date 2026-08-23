# Hiểu hạ tầng ShopFlow trước khi apply

Tệp này giải thích hạ tầng mà `infra/terraform` sắp dựng: từng mảnh là gì, vì sao có mặt, và
`terraform apply` thực sự làm gì theo thứ tự nào.

Đọc cùng: [README.md](README.md) cho lệnh vận hành, [aws-deploy-guide.md](aws-deploy-guide.md) cho
các bước làm lần đầu. Tệp này không có lệnh nào để chạy — nó để hiểu.

---

## 1. Bức tranh một trang

```
                        Internet
                            │
                   ┌────────┴────────┐
                   │   Route 53      │  shopflow.vn ở IP nào?
                   └────────┬────────┘
                            │
                   ┌────────┴────────┐
                   │   CloudFront    │  CDN, chấm dứt HTTPS, chia theo đường dẫn
                   └───┬────┬────┬───┘
              /api/*   │    │    │  /anh/*
            ┌──────────┘    │    └──────────┐
            │          mọi thứ khác         │
            │               │               │
      ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴──────┐
      │    ALB    │   │ S3 web    │   │ S3 images  │
      └─────┬─────┘   └───────────┘   └────────────┘
            │ 3000
      ┌─────┴──────────────────────┐
      │  ECS Fargate — 2 task api  │   subnet riêng, không IP công khai
      └───┬────────────────────┬───┘
          │ 5432               │ 6379
   ┌──────┴──────┐      ┌──────┴───────┐
   │ RDS Postgres│      │ ElastiCache  │
   └─────────────┘      └──────────────┘
```

Tất cả nằm trong `ap-southeast-1` (Singapore), trải trên **hai vùng khả dụng** — mức tối thiểu, vì
RDS đòi subnet group trải hai vùng và ALB cũng vậy.

---

## 2. Kiến thức nền, theo đúng thứ mã nguồn dùng

### VPC, subnet, vùng khả dụng

**VPC** là mạng riêng của bạn trong AWS, dải `10.20.0.0/16`. **Vùng khả dụng** (AZ) là những trung
tâm dữ liệu tách rời nhau trong cùng một vùng — một cái cháy thì cái kia còn sống.

**Subnet** là một lát của VPC, nằm trong đúng một vùng khả dụng. Mã nguồn tạo bốn cái:

| Subnet    | Ai ở đây             | Ra Internet bằng gì              |
| --------- | -------------------- | -------------------------------- |
| 2 public  | ALB, NAT gateway     | Internet gateway, hai chiều      |
| 2 private | task api, RDS, Redis | NAT gateway, chỉ một chiều đi ra |

Khác biệt giữa public và private không nằm ở tên, mà ở **bảng định tuyến**: subnet public có đường
`0.0.0.0/0 → internet gateway`, subnet private có `0.0.0.0/0 → NAT gateway`.

### Internet gateway và NAT gateway

**Internet gateway** cho phép hai chiều: từ ngoài vào được, từ trong ra được. Chỉ subnet public
dùng nó.

**NAT gateway** chỉ cho một chiều: máy bên trong gọi ra được, ngoài Internet không gọi vào được.
Task api cần nó để kéo ảnh container và gọi API bên ngoài, nhưng không được để ai từ Internet gõ
thẳng vào.

Mã nguồn dựng **một** NAT gateway chứ không phải mỗi vùng một cái. Đây là đánh đổi có ghi rõ trong
`network.tf`: rẻ hơn khoảng 35 USD/tháng, đổi lấy việc một vùng khả dụng hỏng thì task ở vùng kia
mất đường ra Internet.

### Security group

Là tường lửa gắn vào từng tài nguyên. Bốn cái, mỗi cái chỉ mở đúng một cửa:

```
alb       ← 443 từ 0.0.0.0/0        (cả Internet)
api       ← 3000 từ security group alb
database  ← 5432 từ security group api
cache     ← 6379 từ security group api
```

Chỗ đáng học: ba luật sau tham chiếu **tới security group khác**, không phải tới dải địa chỉ. Nghĩa
là "chỉ ai đang đeo thẻ alb mới vào được cửa api", bất kể IP nào. Mở rộng mạng về sau không vô tình
mở thêm cửa cho ai — điều sẽ xảy ra nếu viết `cidr_ipv4 = "10.20.0.0/16"`.

### ALB và target group

**Application Load Balancer** đứng ở subnet public, nhận HTTPS rồi chuyển tiếp xuống các task.

**Target group** là danh sách đích, kèm quy tắc kiểm tra sức khoẻ: gọi `/api/v1/healthz` mỗi 15
giây, hai lần liên tiếp trả 200 thì coi là lành mạnh, ba lần hỏng thì rút ra.

Đường dẫn kiểm tra sức khoẻ **cố ý không chạm database**. Nếu nó phụ thuộc database thì một sự cố
database sẽ biến thành mọi task bị giết và thay mới, và cửa hàng mất luôn cả những trang không cần
database.

`deregistration_delay = 30` cho request đang dở 30 giây để chạy xong trước khi task cũ bị rút — đủ
cho một lượt đặt hàng.

Listener chỉ mở **443**. Không có listener 80, nên gõ `http://api.shopflow.vn` sẽ không có ai trả
lời. Trình duyệt đi qua CloudFront nên không gặp chuyện này.

### ECS, Fargate, task definition, service

**ECS** là bộ điều phối container. **Fargate** là chế độ không có máy chủ: bạn không tạo EC2, không
vá hệ điều hành, không SSH vào đâu. Khai báo cần bao nhiêu CPU và RAM, AWS lo phần dưới.

**Task definition** là bản thiết kế của một container: ảnh nào, cổng nào, biến môi trường gì, ghi
log ở đâu. Nó là bản bất biến — mỗi lần đổi sẽ sinh ra một **revision** mới, và revision cũ vẫn còn
nguyên. Đó chính là cơ chế quay lui: trỏ service về revision trước.

**Service** giữ cho luôn có `desired_count` task chạy. Ở đây là 2.

Mã nguồn định nghĩa **hai** task definition:

| Family                  | Chạy gì                    | Kiểu                   |
| ----------------------- | -------------------------- | ---------------------- |
| `shopflow-prod-api`     | Ứng dụng NestJS, cổng 3000 | Service, chạy mãi      |
| `shopflow-prod-migrate` | `prisma migrate deploy`    | Chạy một lần rồi thoát |

Cả hai dùng **cùng một ảnh**, chỉ khác câu lệnh. Nhờ vậy bản migration luôn khớp bản mã sắp chạy.

Service có hai cơ chế đáng biết:

- `deployment_minimum_healthy_percent = 100`, `maximum = 200` — dựng task mới trước, rút task cũ
  sau, nên không có khoảng gián đoạn
- `deployment_circuit_breaker { rollback = true }` — bản mới không lành mạnh thì ECS tự quay về bản
  trước, thay vì để nó vật vã mãi

### Hai vai trò IAM, và vì sao phải tách

| Vai trò     | Của ai                          | Quyền                               |
| ----------- | ------------------------------- | ----------------------------------- |
| `execution` | Hạ tầng ECS, lúc dựng container | Kéo ảnh, đọc 4 tham số SSM, ghi log |
| `task`      | Chính ứng dụng, lúc chạy        | Ghi/đọc/xoá object trong bucket ảnh |

Gộp hai thứ nghĩa là ứng dụng có luôn quyền đọc mọi secret của hệ thống, kể cả những thứ nó không
bao giờ dùng. Tách ra thì mã ứng dụng có bị lợi dụng cũng không đọc được `JWT_SECRET`.

Nhờ vai trò `task`, ứng dụng gọi S3 mà **không cần cặp khoá nào** — SDK tự lấy quyền tạm thời từ
role. Đó là lý do `S3_ACCESS_KEY_ID` và `S3_SECRET_ACCESS_KEY` để trống ở production.

### RDS PostgreSQL

Database quản trị sẵn: AWS lo bản vá, sao lưu, và mật khẩu.

`manage_master_user_password = true` là chi tiết đáng chú ý nhất. RDS tự sinh mật khẩu và cất trong
**Secrets Manager**, nên mật khẩu **không bao giờ xuất hiện trong tệp trạng thái Terraform** — vốn
là nơi mọi giá trị `password` thường bị rò ra.

Giữ bản sao 7 ngày, không nằm trên Internet công khai, mã hoá lúc lưu. `deletion_protection` bật
mặc định, nên `terraform destroy` sẽ dừng lại ở đây — phải sửa mã mới xoá được, và việc phải sửa mã
là một bước dừng có chủ đích.

### ElastiCache Redis

Một node, không nhân bản, không sao lưu. Có chủ đích: Redis ở đây **chỉ giữ bộ đếm rate limit**.
Mất sạch nghĩa là bộ đếm về 0, không mất gì của khách. Mô tả của tài nguyên ghi thẳng
`"Rate limit counters only. Safe to lose."` để sau này không ai vô tình dùng nó làm nơi lưu thứ
không được phép mất.

### Hai bucket S3, hai chế độ khác nhau

| Bucket                 | Nội dung         | Ai đọc được                                   |
| ---------------------- | ---------------- | --------------------------------------------- |
| `shopflow-prod-web`    | Tệp tĩnh của SPA | **Chỉ CloudFront**, qua Origin Access Control |
| `shopflow-prod-images` | Ảnh sản phẩm     | Công khai, ai cũng đọc được                   |

Bucket web bị chặn công khai hoàn toàn. CloudFront ký từng request bằng SigV4 và bucket policy chỉ
chấp nhận request đến từ đúng distribution này. Không ai đi vòng qua CDN để lấy thẳng từ S3.

Bucket ảnh thì ngược lại — ảnh sản phẩm là nội dung công khai, trình duyệt tải trực tiếp, không
mang theo thông tin đăng nhập nào. Chỉ mở quyền **đọc**; ghi vẫn phải qua vai trò `task`.

### CloudFront

CDN, và cũng là bộ định tuyến đường dẫn. Ba origin, ba quy tắc:

| Đường dẫn | Đi tới    | Cache                                                        |
| --------- | --------- | ------------------------------------------------------------ |
| `/api/*`  | ALB       | Tắt hẳn, chuyển tiếp nguyên cookie và header `Authorization` |
| `/anh/*`  | S3 images | Bật, chính sách CachingOptimized                             |
| còn lại   | S3 web    | Bật                                                          |

Vì API đi cùng tên miền với web, trình duyệt không gặp CORS.

Hai `custom_error_response` biến 403 và 404 thành `200` kèm `/index.html`. Đây là chỗ giải quyết
việc mở thẳng một đường dẫn sâu: không có nó thì gõ `/don-hang/SF-260819-0001` vào thanh địa chỉ sẽ
trả lỗi, dù đường dẫn đó hoạt động khi bấm từ trong ứng dụng. Trả `index.html` để vue-router tự xử
lý phần còn lại. `infra/nginx/spa.conf` thực thi đúng quy tắc này khi chạy tại chỗ.

### ACM và hai chứng chỉ

**ACM** cấp chứng chỉ HTTPS miễn phí, xác thực bằng cách yêu cầu bạn tạo một bản ghi DNS mà chỉ chủ
tên miền mới tạo được.

Mã nguồn xin **hai** chứng chỉ cho cùng một hệ thống:

| Chứng chỉ         | Vùng             | Cho                                                                |
| ----------------- | ---------------- | ------------------------------------------------------------------ |
| `shopflow.vn`     | `us-east-1`      | CloudFront — chỉ nhận chứng chỉ ở vùng này, bất kể hạ tầng nằm đâu |
| `api.shopflow.vn` | `ap-southeast-1` | ALB — cần chứng chỉ cùng vùng với chính nó                         |

Đó là lý do `versions.tf` khai báo provider thứ hai với alias `us_east_1`.

### Route 53

Dịch tên miền thành địa chỉ. Terraform ghi bốn bản ghi vào hosted zone của bạn: hai bản ghi xác
thực chứng chỉ, một bản ghi trỏ `shopflow.vn` tới CloudFront, một bản ghi trỏ
`api.shopflow.vn` tới ALB.

Terraform ghi bản ghi xác thực thay vì để người làm tay, vì ACM **chờ** bản ghi đó xuất hiện rồi
mới cấp chứng chỉ — làm tay thì `apply` treo cho tới khi có ai nhớ ra.

### SSM Parameter Store

Nơi giữ 4 giá trị nhạy cảm, kiểu `SecureString`:

```
/shopflow/prod/JWT_SECRET
/shopflow/prod/DATABASE_URL
/shopflow/prod/SWAGGER_USER
/shopflow/prod/SWAGGER_PASSWORD
```

Terraform **tạo tham số nhưng không đặt giá trị thật** — nó ghi chuỗi giữ chỗ
`CHUA-DAT-XEM-infra-README`, kèm `lifecycle { ignore_changes = [value] }` để lần apply sau không
ghi đè giá trị thật.

Lý do: mọi thứ Terraform biết đều nằm trong tệp trạng thái. Giá trị thật do người vận hành ghi
bằng `aws ssm put-parameter`, không đi qua CI, không đi qua state.

ECS đọc chúng lúc dựng container và tiêm thẳng vào biến môi trường. Chúng không nằm trong task
definition, nên `describe-task-definition` không lộ ra gì.

---

## 3. Một request đi qua những đâu

**Mở trang chủ**

```
1. DNS: shopflow.vn → CloudFront          Route 53 trả lời
2. TLS: bắt tay bằng chứng chỉ us-east-1  ACM
3. GET /                                   CloudFront → S3 web → index.html
4. GET /assets/index-abc123.js             CloudFront → S3 web, cache 1 năm
```

**Mở thẳng một đơn hàng**

```
1-2. như trên
3. GET /don-hang/SF-260819-0001            CloudFront → S3 web → không có khoá này
4. S3 trả 403                              custom_error_response → 200 + /index.html
5. vue-router đọc đường dẫn và dựng trang
```

**Gọi API**

```
1. POST /api/v1/orders                     CloudFront, không cache, giữ nguyên cookie
2. → ALB (HTTPS, chứng chỉ ap-southeast-1)
3. → target group → một task đang lành mạnh, cổng 3000
4. task hỏi RDS qua 5432 và Redis qua 6379, cả hai trong subnet riêng
```

---

## 4. `terraform apply` thực sự làm gì

Terraform không chạy từ trên xuống dưới theo thứ tự trong tệp. Nó dựng **đồ thị phụ thuộc** rồi
chạy song song tối đa 10 việc cùng lúc, cái nào có đủ đầu vào thì chạy trước.

### Thứ tự thực tế, và mốc bắt đầu tính tiền

| Thời điểm   | Việc                                                                                                                       | Tính tiền từ đây                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 0–30 giây   | VPC, 4 subnet, internet gateway, 2 bảng định tuyến, 4 security group, 4 tham số SSM, 2 vai trò IAM, log group, 2 bucket S3 | Không                           |
| 30 giây     | Xin 2 chứng chỉ ACM → ghi 2 bản ghi xác thực vào Route 53                                                                  | Không                           |
| ~1–3 phút   | **EIP + NAT gateway**                                                                                                      | **Có** — ~0,048 USD/giờ         |
| 1–5 phút    | Chờ ACM xác thực xong hai chứng chỉ                                                                                        | Không                           |
| ~3–6 phút   | **ALB**                                                                                                                    | **Có** — ~0,025 USD/giờ         |
| ~5–12 phút  | **ElastiCache Redis**                                                                                                      | **Có** — ~0,017 USD/giờ         |
| ~8–15 phút  | **RDS PostgreSQL**                                                                                                         | **Có** — ~0,020 USD/giờ         |
| ~10–20 phút | **CloudFront distribution**                                                                                                | Rất nhỏ                         |
| sau cùng    | ECS cluster, 2 task definition, **service khởi 2 task**, 2 bản ghi A                                                       | **Có** — Fargate ~0,041 USD/giờ |

Tổng khoảng **20 phút**, phần lớn là chờ RDS và CloudFront. Cả cụm khoảng **0,15 USD mỗi giờ**,
tương đương ~112 USD/tháng nếu để nguyên.

Điểm quan trọng: **NAT gateway bắt đầu tính tiền từ phút thứ ba**, rất lâu trước khi apply xong.
Apply hỏng ở giữa không có nghĩa là không mất gì.

### Ba chỗ apply hay dừng lại

**`hosted_zone_id` sai hoặc zone không tồn tại.** Terraform vẫn ghi bản ghi bình thường — nó không
kiểm tra zone có thật hay không. Nhưng `aws_acm_certificate_validation` sẽ chờ ACM xác thực, và ACM
không bao giờ thấy bản ghi. Bước này treo tới **75 phút** rồi mới báo lỗi. Trong lúc đó NAT gateway,
RDS và ALB đã dựng xong và đang tính tiền.

**Ảnh container không tồn tại.** Task definition chỉ ghi tên ảnh, apply không kiểm tra. Service tạo
xong, ECS thử kéo ảnh, thất bại, task chết, circuit breaker quay lui. **Apply vẫn báo thành công.**

**Secret chưa có giá trị thật — chuyện này chắc chắn xảy ra ở lần apply đầu tiên.** Container nhận
`DATABASE_URL = "CHUA-DAT-XEM-infra-README"`, không kết nối được database, chết ngay khi khởi động.
Không thể tránh: chuỗi kết nối cần địa chỉ RDS, mà địa chỉ đó chỉ có sau khi RDS dựng xong.

Nên vòng đời thật của lần đầu là:

```
apply  →  task chết liên tục (bình thường)
       →  ghi 4 secret bằng aws ssm put-parameter
       →  aws ecs update-service --force-new-deployment
       →  task lành mạnh
```

---

## 5. Sau khi apply xong vẫn còn việc

| Việc                                | Vì sao Terraform không làm                    |
| ----------------------------------- | --------------------------------------------- |
| Ghi 4 secret vào SSM                | Giá trị thật không được đi qua tệp trạng thái |
| Tạo vai trò IAM cho GitHub qua OIDC | Không có trong mã Terraform hiện tại          |
| Điền 9 biến và 1 secret vào GitHub  | Lấy từ `tf output` sau khi hạ tầng tồn tại    |
| Đẩy web tĩnh lên S3                 | Workflow Deploy làm, cần bucket có trước      |

---

## 6. Xoá đi thì thế nào

`terraform destroy` sẽ **dừng lại ở RDS**, vì `deletion_protection` đang bật. Muốn xoá thật phải
truyền `-var deletion_protection=false -var skip_final_snapshot=true`, và việc phải gõ thêm hai cờ
đó là một bước dừng có chủ đích.

Những thứ không tự biến mất khi destroy: object trong bucket (S3 từ chối xoá bucket còn dữ liệu),
và bản sao cuối của RDS nếu không bỏ qua.

Khoản đắt nhất không phải lúc dựng, mà là **quên xoá**. Một cụm để quên qua cuối tuần tốn khoảng
7 USD.

---

## 7. Đọc tiếp

| Chỗ                              | Nội dung                                                           |
| -------------------------------- | ------------------------------------------------------------------ |
| `infra/terraform/network.tf`     | VPC, subnet, NAT, security group                                   |
| `infra/terraform/data-stores.tf` | RDS, Redis, bucket ảnh                                             |
| `infra/terraform/ecs.tf`         | IAM, ALB, cluster, task definition, service                        |
| `infra/terraform/web.tf`         | Chứng chỉ, bucket web, CloudFront, DNS                             |
| `infra/terraform/secrets.tf`     | Tham số SSM                                                        |
| `docs/steps/S10.md`              | Vì sao chọn hình thái này, và những gì đã sai khác so với kế hoạch |

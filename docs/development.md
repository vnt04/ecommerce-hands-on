# Phát triển ShopFlow

Bắt đầu với [Chạy nhanh trong README](../README.md#chạy-nhanh).
Tài liệu này bổ sung cấu hình và xử lý sự cố cho môi trường local.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env` và điền các giá trị theo chú thích trong tệp mẫu.
Không commit `.env`. Phiên bản pnpm nằm trong `package.json`, Node trong `.nvmrc`.

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `MINIO_ROOT_PASSWORD`: thay các giá trị mẫu.
- `DOCKER_UID`, `DOCKER_GID`: dùng `id -u`, `id -g` trên Linux/WSL chạy Docker trực tiếp
  để tệp do container tạo có quyền sở hữu phù hợp. Docker Desktop tự ánh xạ user.
- `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT`,
  `MINIO_CONSOLE_PORT`: đổi nếu cổng bị chiếm; cập nhật địa chỉ truy cập tương ứng.
- `WATCH_POLLING=true`: dùng khi web hot reload không nhận thay đổi tệp qua bind mount.
- `DATABASE_URL`: dùng khi chạy Prisma trên máy chủ. API trong Compose tự dựng URL
  từ các biến PostgreSQL và kết nối tới hostname `db`.

## Dữ liệu và tài khoản local

Seed tạo hai thiết kế, mỗi thiết kế ba màu × năm size; có tổ hợp bị tắt và SKU hết
hàng. Seed không tạo ảnh sản phẩm; có thể tải ảnh qua trang quản trị.

Tài khoản được tạo bởi [seed](../apps/api/src/prisma/seed.ts):

- Email: `admin@shopflow.local`.
- Mật khẩu: `admin-doi-mat-khau-ngay`.

Đây là tài khoản phát triển; không dùng seed này cho môi trường công khai chứa dữ
liệu thật. Khách hàng có thể đăng ký từ giao diện. Seed bỏ qua sản phẩm đã tồn tại,
không phải công cụ reset tồn kho hoặc khôi phục trạng thái demo.

Sau khi chạy `pnpm build` trong API container để seed, cần `docker compose restart api`.
Build ghi lại `dist` trong lúc Nest đang watch có thể làm tiến trình khởi động lại
khi chưa có `dist/main.js`. Container còn running không đảm bảo API đang nhận kết nối.

## Lệnh thường dùng

| Lệnh                                   | Tác dụng                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| `docker compose up -d`                 | Khởi động môi trường local                               |
| `docker compose ps`                    | Xem trạng thái container                                 |
| `docker compose logs -f api`           | Theo dõi log API                                         |
| `docker compose restart api`           | Khởi động lại API                                        |
| `docker compose down`                  | Dừng và gỡ container, giữ named volumes                  |
| `pnpm --filter @shopflow/shared build` | Biên dịch package dùng chung trước kiểm tra trên máy chủ |
| `pnpm lint`                            | ESLint toàn workspace                                    |
| `pnpm typecheck`                       | Kiểm tra kiểu                                            |
| `pnpm test`                            | Unit/component test                                      |
| `pnpm --filter @shopflow/api test:int` | Integration test với PostgreSQL qua Testcontainers       |
| `pnpm build`                           | Build các package                                        |
| `pnpm format`                          | Kiểm tra định dạng                                       |
| `pnpm format:write`                    | Định dạng mã và tài liệu                                 |

## Sau khi thay đổi dependency

Ba service Node (`shared`, `api`, `web`) dùng chung các named volume `node_modules`.
Build image mới không tự cập nhật dependency trong volume đã có. Đồng bộ dependency
trong container, rồi khởi động lại các service:

```bash
docker compose stop shared api web
docker compose build shared api web
docker compose run --rm --no-deps api pnpm install --frozen-lockfile
docker compose up -d shared api web
```

Trên máy chủ cũng chạy `pnpm install --frozen-lockfile` để IDE và các lệnh kiểm tra
sử dụng dependency tương ứng. Không dùng `docker compose down -v` để cập nhật
thư viện: tùy chọn `-v` xóa cả volume PostgreSQL và MinIO của môi trường này.

## Kiểm tra dịch vụ

| Endpoint trên API | Ý nghĩa                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `/api/v1/healthz` | Tiến trình phản hồi, không kiểm tra phụ thuộc                        |
| `/api/v1/readyz`  | Kiểm tra cả PostgreSQL và Redis; trả 503 khi phụ thuộc chưa sẵn sàng |

Tách hai endpoint giúp sự cố database không bị hiểu nhầm thành tiến trình API chết.
Khi lỗi khởi động, kiểm tra log API và readiness, không chỉ trạng thái container.

## Tài liệu API

Mở `http://localhost:3000/api/v1/docs` với cổng mặc định; thay `3000` theo `API_PORT`.
OpenAPI được xây dựng từ schema Zod và các decorator API.

| Đường dẫn           | Nội dung     |
| ------------------- | ------------ |
| `/api/v1/docs`      | Swagger UI   |
| `/api/v1/docs-json` | OpenAPI JSON |
| `/api/v1/docs-yaml` | OpenAPI YAML |

Bỏ trống `SWAGGER_USER` và `SWAGGER_PASSWORD` để mở tự do ở local. Đặt cả hai để
bật Basic Auth cho ba đường dẫn. Production yêu cầu cả hai biến khi khởi động.

## Kho ảnh

MinIO Console mặc định ở `http://localhost:9001` (theo `MINIO_CONSOLE_PORT`), đăng
nhập bằng các biến `MINIO_ROOT_USER` và `MINIO_ROOT_PASSWORD`.

API dùng endpoint nội bộ `http://minio:9000` để ghi ảnh; trình duyệt tải ảnh qua
`http://localhost:9000` với cổng theo `MINIO_PORT`. Hai địa chỉ khác nhau vì hostname
`minio` chỉ tồn tại trong mạng Compose.

Cấu hình production dùng S3, gồm endpoint/region/bucket/public URL và thông tin xác
thực hoặc IAM role. Xem [hướng dẫn hạ tầng](../infra/README.md).

Dataset lớn phục vụ luyện SQL có hướng dẫn riêng tại [SQL Gym](sql-gym/README.md).

# ShopFlow

Cửa hàng bán áo thun in sẵn trực tuyến cho thị trường Việt Nam.

Áo được in trước và lưu kho theo từng cặp màu × size. Khách hàng chọn thiết kế, chọn màu và size, đặt hàng. Quản trị viên quản lý thiết kế, tồn kho theo SKU và xử lý đơn hàng.

## Phạm vi

| Thuộc phạm vi                              | Ngoài phạm vi                   |
| ------------------------------------------ | ------------------------------- |
| Catalog thiết kế có biến thể màu × size    | In theo đơn (print-on-demand)   |
| Giỏ hàng, kể cả khách chưa đăng nhập       | Khách tự tải lên thiết kế       |
| Đặt hàng, theo dõi đơn, email giao dịch    | Marketplace đa nhà bán          |
| Quản trị thiết kế, tồn kho, đơn hàng       | Tự lưu trữ và xử lý dữ liệu thẻ |
| Báo cáo doanh thu và phân bổ bán theo size | Đa ngôn ngữ, đa tiền tệ         |

## Nguyên tắc đánh đổi

Ba tiêu chí xếp theo thứ tự ưu tiên, dùng để phân xử mọi lựa chọn kỹ thuật:

1. Đơn hàng và tiền phải chính xác. Không bán vượt tồn, không tạo trùng đơn, giá trên đơn đã đặt không thay đổi khi bảng giá thay đổi.
2. Một người vận hành được. Triển khai tự động, rollback nhanh, log và cảnh báo đủ để xác định điểm hỏng.
3. Chi phí tương xứng lưu lượng thực tế.

Khi hai phương án tương đương, chọn phương án đơn giản hơn về mặt vận hành.

## Công nghệ

Vue 3 + Vite (SPA) · NestJS · Prisma · PostgreSQL 16 · Docker · AWS + Terraform · GitHub Actions

Monorepo gồm `apps/web`, `apps/api` và `packages/shared`.

## Lộ trình

| Bước                       | Nội dung                           | Trạng thái |
| -------------------------- | ---------------------------------- | ---------- |
| [S01](docs/steps/S01.md)   | Khởi tạo khung dự án               | Hoàn thành |
| [S02](docs/steps/S02.md)   | Khung ứng dụng và cơ sở dữ liệu    | Hoàn thành |
| [S03](docs/steps/S03.md)   | Lược đồ sản phẩm và logic biến thể | Hoàn thành |
| [S04](docs/steps/S04.md)   | API catalog công khai              | Hoàn thành |
| [S05](docs/steps/S05.md)   | Giao diện khách cho catalog        | Hoàn thành |
| [S06](docs/steps/S06.md)   | Tài khoản và xác thực              | Hoàn thành |
| [S07](docs/steps/S07.md)   | Giỏ hàng                           | Hoàn thành |
| [S08](docs/steps/S08.md)   | Đặt hàng và trừ tồn kho            | Hoàn thành |
| [S09](docs/steps/S09.md)   | Quản lý đơn hàng                   | Hoàn thành |
| [S09b](docs/steps/S09b.md) | Quản trị sản phẩm và tồn kho       | Hoàn thành |
| [S10](docs/steps/S10.md)   | Triển khai production              | Chờ AWS    |
| S11                        | Giám sát và vận hành               |            |

Dự án triển khai tuần tự theo bước. Mỗi bước có tài liệu riêng, được viết chi tiết ngay trước khi thực hiện và dựa trên kết quả thực tế của bước liền trước. S08 là bước có rủi ro cao nhất do liên quan đồng thời tới tiền và tồn kho.

## Chạy dự án

Yêu cầu: Docker và Docker Compose. Node.js 22 trở lên trên máy chủ nếu muốn chạy lint, typecheck và test trực tiếp.

```bash
cp .env.example .env      # mật khẩu database, JWT_SECRET, DOCKER_UID, DOCKER_GID, cổng
pnpm install              # phục vụ IDE, git hook và các lệnh chạy trực tiếp
docker compose up -d      # db, redis, api, web — cổng publish lấy từ .env
```

Áp dụng migration và nạp dữ liệu mẫu:

```bash
docker compose exec api sh -c "cd apps/api && pnpm exec prisma migrate deploy"
docker compose exec api sh -c "cd apps/api && pnpm build && pnpm exec prisma db seed"
```

Dữ liệu mẫu gồm hai thiết kế, mỗi thiết kế ba màu × năm size. Cố ý có một tổ hợp bị tắt và một
SKU hết hàng: dữ liệu quá sạch che mất đúng những trạng thái hay hỏng nhất.

Mở `http://localhost:5173`. Trang hiển thị trạng thái trả về từ `/api/v1/healthz` và một số tiền định dạng bởi `@shopflow/shared`.

Lấy `DOCKER_UID` và `DOCKER_GID` bằng `id -u` và `id -g`. Nếu bỏ qua bước này trên Linux hoặc WSL, tệp do container tạo ra sẽ không sửa được từ máy chủ. Trên macOS và Windows dùng Docker Desktop thì không cần quan tâm.

Hot reload không hoạt động trên macOS hoặc Windows thì đặt `WATCH_POLLING=true` trong `.env` rồi khởi động lại.

### Lệnh

| Lệnh                         | Tác dụng                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `docker compose up -d`       | Khởi động database, api và web                                 |
| `docker compose logs -f api` | Xem log một service                                            |
| `docker compose down`        | Dừng. Thêm `-v` để xoá luôn dữ liệu database                   |
| `docker compose build`       | Dựng lại image. **Chạy cho cả ba service**, xem lưu ý bên dưới |
| `pnpm lint`                  | ESLint toàn bộ workspace                                       |
| `pnpm typecheck`             | Kiểm tra kiểu                                                  |
| `pnpm test`                  | Chạy toàn bộ test                                              |
| `pnpm build`                 | Build cả ba package                                            |
| `pnpm format:write`          | Định dạng lại mã nguồn bằng Prettier                           |

Chạy `pnpm build` hoặc `pnpm typecheck` lần đầu trên máy sạch cần `@shopflow/shared` được biên dịch trước: `pnpm --filter @shopflow/shared build`.

### Cổng bị chiếm

Cổng publish đọc từ `.env`. Máy đang chạy dự án khác giữ cùng cổng thì đổi `API_PORT`,
`WEB_PORT`, `REDIS_PORT` hoặc `POSTGRES_PORT` — bên trong Compose các service vẫn dùng cổng
chuẩn nên không phải sửa gì thêm.

Triệu chứng khi quên đổi rất dễ gây nhầm: container vẫn chạy, nhưng mở trang lại thấy nội dung
của ứng dụng khác.

### Sau khi thêm hoặc gỡ dependency

Thư mục `node_modules` trong container là named volume, mà Docker chỉ nạp nội dung từ image
khi volume còn rỗng. Dựng lại image thôi là chưa đủ, phải xoá volume:

```bash
docker compose down -v
docker compose build      # cả ba service, vì chúng dùng chung volume node_modules
docker compose up -d
```

Bỏ qua bước này thì container vẫn chạy với bộ dependency cũ và báo lỗi không tìm thấy module.

### Endpoint kiểm tra

| Đường dẫn         | Kiểm tra gì                                    | Dùng cho          |
| ----------------- | ---------------------------------------------- | ----------------- |
| `/api/v1/healthz` | Tiến trình còn phản hồi. Không chạm database   | Kiểm tra sống     |
| `/api/v1/readyz`  | Có phục vụ được không, gồm cả kết nối database | Kiểm tra sẵn sàng |

### Kho ảnh

Ảnh sản phẩm nằm trên MinIO, một kho nói giao thức S3. Bảng điều khiển của nó ở
`http://localhost:${MINIO_CONSOLE_PORT}`, đăng nhập bằng `MINIO_ROOT_USER` và `MINIO_ROOT_PASSWORD`
trong `.env`.

Ở production kho này là S3 thật. Mã trong `apps/api` không đổi: chỉ đổi `S3_ENDPOINT`, `S3_REGION`,
cặp khoá và `S3_PUBLIC_URL`.

Hai endpoint tách biệt có chủ đích: nếu kiểm tra sống phụ thuộc database thì một sự cố
database sẽ khiến bộ điều phối khởi động lại container liên tục trong khi ứng dụng vẫn khoẻ.

### Quy ước commit

Conventional Commits, kiểm tra tự động lúc commit:

```
feat(api): add health endpoint
fix(web): correct proxy target inside container
```

Hook trước khi commit chạy ESLint, Prettier và quét secret trên các tệp được stage.

## Tài liệu

| Nội dung                                   | Vị trí                             |
| ------------------------------------------ | ---------------------------------- |
| Hướng dẫn cho AI làm việc trong repository | [CLAUDE.md](CLAUDE.md)             |
| Bước đang thực hiện                        | [docs/steps/](docs/steps/)         |
| Quyết định kiến trúc và lý do              | [docs/decisions/](docs/decisions/) |
| Tài liệu đã ngừng sử dụng, giữ để tra cứu  | [docs/archive/](docs/archive/)     |

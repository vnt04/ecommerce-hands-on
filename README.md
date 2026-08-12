# ShopFlow

Cửa hàng bán áo thun in sẵn trực tuyến cho thị trường Việt Nam.

Áo được in trước và lưu kho theo từng cặp màu × size. Khách hàng chọn thiết kế, chọn màu và size, đặt hàng. Quản trị viên quản lý thiết kế, tồn kho theo SKU và xử lý đơn hàng.

## Phạm vi

| Thuộc phạm vi | Ngoài phạm vi |
|---|---|
| Catalog thiết kế có biến thể màu × size | In theo đơn (print-on-demand) |
| Giỏ hàng, kể cả khách chưa đăng nhập | Khách tự tải lên thiết kế |
| Đặt hàng, theo dõi đơn, email giao dịch | Marketplace đa nhà bán |
| Quản trị thiết kế, tồn kho, đơn hàng | Tự lưu trữ và xử lý dữ liệu thẻ |
| Báo cáo doanh thu và phân bổ bán theo size | Đa ngôn ngữ, đa tiền tệ |

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

| Bước | Nội dung | Trạng thái |
|---|---|---|
| [S01](docs/steps/S01.md) | Khởi tạo khung dự án | Chờ phê duyệt |
| S02 | Khung ứng dụng và cơ sở dữ liệu | |
| S03 | Domain sản phẩm và biến thể | |
| S04 | Catalog công khai | |
| S05 | Tài khoản và xác thực | |
| S06 | Giỏ hàng | |
| S07 | Đặt hàng và trừ tồn kho | |
| S08 | Quản lý đơn hàng | |
| S09 | Triển khai production | |
| S10 | Giám sát và vận hành | |

Dự án triển khai tuần tự theo bước. Mỗi bước có tài liệu riêng, được viết chi tiết ngay trước khi thực hiện và dựa trên kết quả thực tế của bước liền trước. S07 là bước có rủi ro cao nhất do liên quan đồng thời tới tiền và tồn kho.

## Chạy dự án

Chưa khả dụng. Mục này được bổ sung khi hoàn thành S01.

## Tài liệu

| Nội dung | Vị trí |
|---|---|
| Hướng dẫn cho AI làm việc trong repository | [CLAUDE.md](CLAUDE.md) |
| Bước đang thực hiện | [docs/steps/](docs/steps/) |
| Tài liệu đã ngừng sử dụng, giữ để tra cứu | [docs/archive/](docs/archive/) |

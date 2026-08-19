# ADR-002 — Thực thể lộ ra URL có định danh công khai riêng

|            |                                          |
| ---------- | ---------------------------------------- |
| Trạng thái | Accepted                                 |
| Ngày       | 2026-08-19                               |
| Bước       | S02                                      |
| Liên quan  | [ADR-001](ADR-001-khoa-chinh-tu-tang.md) |

## Bối cảnh

ADR-001 chọn khoá chính tự tăng và chấp nhận một hệ quả: id tuần tự lộ sản lượng. Đối thủ
đặt hai đơn cách nhau một tuần, so hai id, biết được số đơn bán ra giữa hai lần đó.

Đây không phải lỗ hổng bảo mật — kiểm tra quyền sở hữu ở backend vẫn chặn việc đọc đơn của
người khác — mà là rò rỉ thông tin kinh doanh.

## Các phương án

### A. Định danh công khai riêng cho thực thể lộ ra URL — **Chọn**

Khoá chính tự tăng giữ nguyên cho nội bộ. Thực thể xuất hiện trên URL có thêm một cột định danh
công khai, unique, không suy ra được từ id.

### B. Dùng thẳng id số trên URL

Ít cột hơn, ít mã hơn. Loại vì đúng vấn đề nêu ở phần bối cảnh, và vì thêm định danh công khai
sau khi đã có đơn hàng thật đòi hỏi backfill toàn bộ dữ liệu cũ.

### C. Mã hoá id thành chuỗi khi trả ra (Hashids hoặc tương tự)

Không cần thêm cột. Loại vì mã hoá hai chiều dựa trên một khoá bí mật: lộ khoá là lộ toàn bộ
ánh xạ, và mã sinh ra vẫn không đọc được qua điện thoại.

## Quyết định

| Bảng       | Khoá chính  | Định danh công khai                   |
| ---------- | ----------- | ------------------------------------- |
| `orders`   | `BIGSERIAL` | `order_number`, dạng `SF-260819-0001` |
| `products` | `BIGSERIAL` | `slug`                                |
| `users`    | `BIGSERIAL` | không lộ ra URL                       |

Khoá ngoại giữa các bảng vẫn dùng id số. Chỉ lớp API dịch sang định danh công khai.

## Lý do

`order_number` giải quyết cùng lúc hai việc: không lộ sản lượng, và đọc được qua điện thoại khi
hỗ trợ khách. `slug` vốn đã cần cho SEO nên không phát sinh chi phí mới.

## Đánh đổi phải chấp nhận

Mỗi thực thể công khai có hai định danh, nên mọi endpoint nhận tham số phải tra cứu theo định
danh công khai rồi mới có id nội bộ — thêm một chỉ mục và một bước tra cứu.

Sinh `order_number` có bộ đếm theo ngày là điểm tranh chấp khi hai đơn được đặt đồng thời.
Phải dùng sequence hoặc khoá, không dùng `SELECT MAX() + 1`. Xử lý ở bước đặt hàng.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                                           | Ngưỡng                                                                   | Đo bằng              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------- |
| Tra cứu theo định danh công khai trở thành điểm nghẽn              | p95 của endpoint theo id vượt 300ms và `EXPLAIN` chỉ ra bước tra cứu này | `pg_stat_statements` |
| Xuất hiện thực thể thứ ba lộ ra URL mà chưa có định danh công khai | Ngay khi thiết kế endpoint cho nó                                        | Review API contract  |

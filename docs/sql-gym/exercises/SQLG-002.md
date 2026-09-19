# SQLG-002

## 1. Context

Bộ phận vận hành cần kiểm tra nguồn khách hàng và tình trạng ghi chú giao hàng của các đơn trong tháng 08/2026.

## 2. Business requirement

Lấy 30 đơn được đặt gần đây nhất trong tháng 08/2026 và phân loại:

- Đơn không có tài khoản: `GUEST`.
- Đơn thuộc một tài khoản: `REGISTERED`.
- Đơn có ghi chú: `HAS_NOTE`.
- Đơn không có ghi chú: `NO_NOTE`.

## 3. Expected output

Mỗi dòng gồm:

- `order_number`
- `customer_type`
- `note_status`
- `status`
- `total`
- `placed_at`

Sắp xếp theo `placed_at` mới nhất trước. Nếu thời gian bằng nhau, đơn có `id` lớn hơn đứng trước.

## 4. Relevant constraints/business rules

- `user_id IS NULL` nghĩa là guest order.
- Chỉ `note IS NULL` mới được xem là không có ghi chú.
- Khoảng thời gian bắt đầu tại `2026-08-01 00:00:00+07`.
- Khoảng thời gian kết thúc trước `2026-09-01 00:00:00+07`.
- Không lọc theo trạng thái đơn hoặc trạng thái thanh toán.
- Tên và giá trị các cột đầu ra phải đúng như yêu cầu.
- Không trả về `id` và `user_id`.

## 5. Difficulty

Level 1 — Basic SQL, `NULL` và cột kết quả dẫn xuất.

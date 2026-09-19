# SQLG-004

## 1. Context

Bộ phận chăm sóc khách hàng cần đối chiếu người nhận đơn với tài khoản đặt hàng trong tháng 08/2026.

## 2. Business requirement

Lấy 50 đơn có ID lớn nhất trong tháng 08/2026, kèm thông tin tài khoản nếu có. Giữ cả đơn guest.

## 3. Expected output

- `order_number`
- `recipient_name`
- `account_name`: `users.full_name`; để NULL nếu không có tài khoản.
- `account_email`: `users.email`; để NULL nếu không có tài khoản.
- `total`
- `placed_at`

Mỗi đơn xuất hiện đúng một lần. Sắp xếp theo `orders.id` giảm dần.

## 4. Relevant constraints/business rules

- Dùng quan hệ `orders.user_id` tham chiếu `users.id`.
- `orders.user_id` có thể NULL. Không được loại các đơn này.
- Khoảng thời gian: từ `2026-08-01 00:00:00+07` đến trước `2026-09-01 00:00:00+07`.
- Không lọc trạng thái đơn, thanh toán hoặc vai trò tài khoản.
- `recipient_name` lấy từ đơn; không thay thế tên tài khoản bị thiếu bằng tên người nhận.
- Không trả về ID nội bộ. Giới hạn 50 áp dụng cho toàn bộ tập đơn phù hợp.

## 5. Difficulty

Level 2 — Hai bảng với quan hệ tùy chọn.

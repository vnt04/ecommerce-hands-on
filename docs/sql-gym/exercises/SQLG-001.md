# SQLG-001

## 1. Context

Bộ phận chăm sóc khách hàng cần kiểm tra các đơn chưa thanh toán được đặt trong tháng 08/2026.

## 2. Business requirement

Trả về 20 đơn chưa thanh toán được đặt gần đây nhất trong tháng 08/2026, tính theo múi giờ `+07:00`.

## 3. Expected output

Mỗi dòng gồm:

- `order_number`
- `recipient_name`
- `recipient_phone`
- `status`
- `payment_method`
- `total`
- `placed_at`

Sắp xếp đơn mới nhất trước. Nếu hai đơn có cùng `placed_at`, đơn có `id` lớn hơn đứng trước.

## 4. Relevant constraints/business rules

- “Chưa thanh toán” tương ứng với `payment_status = 'UNPAID'`.
- Khoảng thời gian bắt đầu tại `2026-08-01 00:00:00+07`.
- Khoảng thời gian kết thúc trước `2026-09-01 00:00:00+07`.
- Không loại bỏ guest order.
- Không cần trả về cột `id`.

## 5. Difficulty

Level 1 — Basic SQL.

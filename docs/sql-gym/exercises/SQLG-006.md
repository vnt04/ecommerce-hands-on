# SQLG-006

## 1. Context

Bộ phận chăm sóc khách hàng cần tìm các tài khoản đã có nhiều đơn thanh toán thành công để ưu tiên chăm sóc.

## 2. Business requirement

Trên toàn bộ lịch sử, lấy tối đa 20 khách hàng có ít nhất 2 đơn hiện đang ở trạng thái thanh toán PAID,
ưu tiên khách có tổng giá trị các đơn PAID cao nhất.

## 3. Expected output

- `customer_email`: email tài khoản.
- `customer_name`: tên đầy đủ của tài khoản.
- `paid_order_count`: số đơn PAID của khách.
- `total_paid_order_value`: tổng `orders.total` của các đơn PAID, đơn vị đồng.
- `latest_paid_order_placed_at`: thời điểm đặt mới nhất trong các đơn PAID của khách.

Mỗi tài khoản một dòng. Sắp xếp `total_paid_order_value` giảm dần; nếu bằng nhau,
`customer_email` tăng dần.

## 4. Relevant constraints/business rules

- Dùng quan hệ `orders.user_id` tham chiếu `users.id`.
- Chỉ lấy tài khoản có `users.role = 'CUSTOMER'`; loại guest order.
- Đơn phù hợp có `orders.payment_status = 'PAID'`; không thêm điều kiện về `orders.status`.
- Tất cả chỉ số và ngưỡng ít nhất 2 đơn đều chỉ tính trên các đơn PAID.
- Không giới hạn khoảng thời gian.
- Dùng `orders.placed_at` cho thời điểm đặt; đây không phải thời điểm thanh toán.
- `users.email` là duy nhất; tên khách hàng không được bảo đảm duy nhất.
- Không trả về ID nội bộ.

## 5. Difficulty

Level 3 — Tổng hợp theo khách hàng và điều kiện trên kết quả tổng hợp.

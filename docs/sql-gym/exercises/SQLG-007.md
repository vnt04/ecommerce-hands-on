# SQLG-007

## 1. Context

Bộ phận chăm sóc khách hàng cần báo cáo hoạt động mua hàng tháng 08/2026, bao gồm cả khách chưa có đơn đã thanh toán trong tháng.

## 2. Business requirement

Với mỗi tài khoản CUSTOMER, tính số đơn PAID và tổng giá trị các đơn PAID được đặt trong tháng 08/2026. Phải giữ cả khách không có đơn phù hợp.

## 3. Expected output

Mỗi tài khoản một dòng:

- `customer_email`
- `customer_name`
- `paid_order_count`
- `total_paid_order_value`
- `latest_paid_order_placed_at`

Sắp xếp theo `users.id` tăng dần. Không giới hạn số dòng.

## 4. Relevant constraints/business rules

- Chỉ lấy tài khoản có `users.role = 'CUSTOMER'`.
- Đơn phù hợp có `payment_status = 'PAID'` và `placed_at` từ `2026-08-01 00:00:00+07` đến trước `2026-09-01 00:00:00+07`.
- Không thêm điều kiện về trạng thái đơn.
- Nếu không có đơn phù hợp: số đơn là `0`, tổng giá trị là `0`, thời điểm đặt mới nhất là `NULL`.
- Khách chỉ có đơn ngoài tháng hoặc đơn không PAID vẫn phải xuất hiện với các giá trị trên.
- Quan hệ: `orders.user_id` tham chiếu `users.id`. Guest order không thuộc tài khoản nào trong báo cáo.
- Tên khách lấy từ `users.full_name`, email từ `users.email`, giá trị đơn từ `orders.total` (đồng).
- Không gộp khách trùng tên và không trả về ID nội bộ.

## 5. Difficulty

Level 3 — Tổng hợp hai bảng và xử lý trường hợp không có dữ liệu phù hợp.

# SQLG-009

## 1. Context

Bộ phận đóng gói cần danh sách đơn có nhiều sản phẩm để bố trí xử lý riêng.

## 2. Business requirement

Lấy tối đa 30 đơn được đặt trong tháng 08/2026 có tổng số lượng sản phẩm từ 8 trở lên,
ưu tiên đơn có tổng số lượng lớn nhất. Kèm email tài khoản nếu có.

## 3. Expected output

- `order_number`
- `account_email`
- `item_line_count`: số dòng chi tiết đơn.
- `total_quantity`: tổng số lượng sản phẩm trong đơn.
- `order_total`: giá trị đơn từ `orders.total`.
- `placed_at`

Mỗi đơn một dòng. Sắp xếp `total_quantity` giảm dần, sau đó `placed_at` giảm dần,
cuối cùng `orders.id` giảm dần.

## 4. Relevant constraints/business rules

- Thời điểm đặt: từ `2026-08-01 00:00:00+07` đến trước `2026-09-01 00:00:00+07`.
- Bao gồm mọi trạng thái đơn và thanh toán; đây là báo cáo thống kê, không phải lệnh xuất kho.
- `order_items.order_id` tham chiếu `orders.id`; mỗi dòng có `quantity` riêng.
- Một dòng có `quantity = 4` được tính là 1 dòng chi tiết và 4 sản phẩm.
- Không giả định mỗi đơn luôn có 3 dòng, dù dữ liệu seed hiện tại có đặc điểm này.
- `orders.user_id` tham chiếu `users.id`; giữ cả guest order đủ điều kiện, email của guest là NULL.
- `order_total` là giá trị của một đơn, không nhân lên theo số dòng chi tiết.
- Không trả về ID nội bộ.

## 5. Difficulty

Level 3 — Báo cáo ba bảng, phân biệt số dòng và số lượng sản phẩm.

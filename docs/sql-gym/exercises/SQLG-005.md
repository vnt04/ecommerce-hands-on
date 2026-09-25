# SQLG-005

## 1. Context

Bộ phận vận hành cần báo cáo quy mô đơn hàng tháng 08/2026 theo trạng thái hiện tại.

## 2. Business requirement

Với mỗi trạng thái có đơn được đặt trong tháng 08/2026, trả về số đơn và tổng giá trị các đơn đó.

## 3. Expected output

- `status`: trạng thái đơn.
- `order_count`: số đơn.
- `total_order_value`: tổng giá trị `orders.total`, đơn vị đồng.

Mỗi trạng thái xuất hiện đúng một dòng. Sắp xếp `order_count` giảm dần; nếu bằng nhau,
sắp xếp tên trạng thái theo thứ tự chữ cái tăng dần.

## 4. Relevant constraints/business rules

- Dùng thời điểm đặt đơn `placed_at`, từ `2026-08-01 00:00:00+07` đến trước `2026-09-01 00:00:00+07`.
- Bao gồm cả guest order và đơn có tài khoản.
- Bao gồm tất cả trạng thái đơn và thanh toán, kể cả đơn bị hủy.
- Tổng giá trị đơn không đồng nghĩa doanh thu đã thu; không trừ tiền hoàn và không lọc đơn đã thanh toán.
- Trạng thái là trạng thái hiện tại trong `orders.status`, không phải trạng thái tại cuối tháng.
- Chỉ hiển thị trạng thái có đơn phù hợp; không giới hạn số dòng kết quả.
- `status` là enum PostgreSQL; yêu cầu thứ tự chữ cái khác với thứ tự khai báo enum.

## 5. Difficulty

Level 3 — Báo cáo tổng hợp cơ bản trên một bảng.

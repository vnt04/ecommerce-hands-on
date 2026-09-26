# SQLG-010

## 1. Context

Bộ phận chăm sóc khách hàng cần kiểm tra giỏ hàng hết hạn trong một danh sách tài khoản khách hàng.

## 2. Business requirement

Lấy 50 tài khoản CUSTOMER có ID nhỏ nhất. Với mỗi tài khoản, hiển thị thông tin giỏ hàng nếu giỏ đó hết hạn trước mốc 2026-09-15 00:00:00+07.

## 3. Expected output

- `customer_email`: users.email.
- `customer_name`: users.full_name.
- `expired_cart_created_at`: thời điểm tạo giỏ hết hạn.
- `expired_cart_expires_at`: thời điểm hết hạn của giỏ.

Mỗi tài khoản một dòng, sắp xếp users.id tăng dần.

## 4. Relevant constraints/business rules

- Chỉ lấy users.role = 'CUSTOMER'.
- carts.user_id tham chiếu users.id và có ràng buộc unique: một tài khoản có tối đa một giỏ.
- Giỏ phù hợp phải có expires_at nhỏ hơn '2026-09-15 00:00:00+07'; đúng tại mốc không được tính.
- Nếu tài khoản không có giỏ hoặc giỏ không thỏa điều kiện hết hạn, tài khoản vẫn xuất hiện; cả hai cột giỏ là NULL.
- Thời điểm tạo giỏ lấy từ carts.created_at; thời điểm hết hạn lấy từ carts.expires_at.
- Giỏ anonymous có user_id NULL không thuộc tài khoản nào trong báo cáo.
- Giới hạn 50 áp dụng cho tài khoản CUSTOMER, không phải chỉ những tài khoản có giỏ hết hạn.
- Không dùng thời gian hiện tại thay mốc cố định; không trả về ID nội bộ.

## 5. Difficulty

Level 2 — Bài củng cố quan hệ tùy chọn và điều kiện thời gian.

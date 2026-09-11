# Database profile

Khảo sát trực tiếp ngày 2026-09-11 sau khi large seed hoàn tất. Số dòng lớn là số thực hoặc thống kê
sau `ANALYZE`; kích thước gồm cả table và index.

## Quy mô

| Bảng                   | Dòng xấp xỉ | Kích thước |
| ---------------------- | ----------: | ---------: |
| `order_status_history` |   3.000.000 |     408 MB |
| `order_items`          |   3.000.000 |     533 MB |
| `product_variants`     |   2.000.000 |     455 MB |
| `variant_changes`      |   2.000.000 |     312 MB |
| `cart_items`           |   2.000.000 |     294 MB |
| `product_images`       |   1.000.000 |     182 MB |
| `orders`               |   1.000.000 |     732 MB |
| `products`             |     500.000 |     202 MB |
| `users`                |     500.000 |     124 MB |
| `refresh_tokens`       |     500.000 |     197 MB |
| `carts`                |     500.000 |     105 MB |
| `idempotency_keys`     |     500.000 |     140 MB |

Các bảng tra cứu: 200 `categories`, 100 `colors`, 100 `size_charts`, 8 `sizes`; bảng
`order_number_counters` có 2.071 dòng.

## Quan hệ chính

- Catalog: `categories -> products -> product_variants`; variant tham chiếu `colors` và `sizes`.
- Media: `product_images -> products`, màu ảnh có thể `NULL`.
- Cart: `users -> carts -> cart_items -> product_variants`; giỏ thuộc user hoặc token ẩn danh.
- Order: `users -> orders -> order_items`; `order_items.variant_id` có thể `NULL` để snapshot đơn vẫn
  tồn tại khi variant bị xóa.
- Audit: `orders -> order_status_history`; `product_variants -> variant_changes`; người thay đổi có
  thể `NULL` khi do hệ thống hoặc tài khoản đã bị xóa.
- Auth/idempotency: `users -> refresh_tokens`; `idempotency_keys` có thể thiếu user hoặc order.

## Phân bố đáng chú ý

- Orders: 1.000.000 dòng từ 2021-01-01 đến 2026-09-01; 800.000 có user, 200.000 guest.
- Trạng thái đơn: 550k `DELIVERED`, 200k `SHIPPING`, 100k `CONFIRMED`, 100k `PENDING`, 50k
  `CANCELLED`.
- Thanh toán: 750k `PAID`, 200k `UNPAID`, 50k `REFUNDED`; 750k COD và 250k gateway.
- Tổng đơn: 542.000–8.698.000 đồng, trung bình khoảng 3.363.752 đồng.
- Mỗi đơn hiện có đúng 3 `order_items`; quantity từ 1 đến 4. Đây là phân bố đều do generator và là
  giới hạn về độ chân thực cần nhớ khi phân tích.
- Products: 475k `PUBLISHED`, 25k `DRAFT`, chia qua 200 category gần như đều.
- Variants: 1,96M active, 40k inactive, 6.644 hết hàng; 140 mức giá từ 99k đến 794k.
- Carts: 250k của user, 250k anonymous; khoảng 254k đã hết hạn tại thời điểm khảo sát.
- Users: 499.900 `CUSTOMER`, 100 `ADMIN`.
- Riêng tháng 08/2026 có 14.973 orders, đủ dữ liệu cho bài đầu tiên.

## Index đáng chú ý

- `orders(status, placed_at)`, `orders(user_id, placed_at)`, `orders(recipient_phone)`.
- `order_items(order_id)`.
- `product_variants(product_id, color_id, size_id)` unique và thêm index riêng `product_id`.
- `products(category_id, status)` và GIN trigram trên tên đã bỏ dấu.
- Audit indexes: `(order_id, created_at)` và `(variant_id, created_at)`.
- Một số foreign key nullable không có index riêng, như `idempotency_keys.order_id`,
  `order_status_history.changed_by_id`, `variant_changes.changed_by_id`. Chưa kết luận là thiếu index;
  phải dựa trên workload và execution plan.
- Index `product_variants(product_id)` có thể trùng công dụng với tiền tố của unique index
  `(product_id, color_id, size_id)`. Cần đo workload trước khi quyết định bỏ.

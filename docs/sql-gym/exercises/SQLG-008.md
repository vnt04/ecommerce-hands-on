# SQLG-008

## 1. Context

Bộ phận kho cần báo cáo các biến thể đang bật nhưng sắp hết hàng của từng sản phẩm đang kinh doanh.

## 2. Business requirement

Với mỗi sản phẩm đã xuất bản và chưa lưu trữ, tính số biến thể đang bật có tồn kho từ 0 đến 5 và tổng tồn kho của những biến thể đó. Giữ cả sản phẩm không có biến thể phù hợp.

## 3. Expected output

- `design_code`
- `product_name`
- `low_stock_variant_count`
- `low_stock_total_quantity`

Mỗi sản phẩm một dòng, sắp xếp theo `products.id` tăng dần. Không giới hạn số dòng.

## 4. Relevant constraints/business rules

- Sản phẩm thuộc báo cáo có `products.status = 'PUBLISHED'` và `products.archived_at IS NULL`.
- Biến thể phù hợp có `product_variants.is_active = true` và `stock_quantity` từ 0 đến 5, bao gồm cả hai đầu.
- Quan hệ: `product_variants.product_id` tham chiếu `products.id`.
- Chỉ các biến thể phù hợp đóng góp vào số lượng biến thể và tổng tồn kho.
- Nếu không có biến thể phù hợp, cả hai chỉ số bằng 0; sản phẩm vẫn phải xuất hiện.
- Một biến thể tồn kho 0 vẫn được tính là một biến thể phù hợp.
- Không gộp sản phẩm trùng tên; tên sản phẩm lấy từ `products.name`.
- Không trả về ID nội bộ.

## 5. Difficulty

Level 3 — Báo cáo tồn kho, bao gồm sản phẩm không có biến thể phù hợp.

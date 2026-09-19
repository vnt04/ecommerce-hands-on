# SQLG-003

## 1. Context

Trang quản trị cần hiển thị các sản phẩm đang kinh doanh thuộc danh mục có slug `category-42`.

## 2. Business requirement

Lấy 25 sản phẩm được tạo gần đây nhất thuộc danh mục `category-42`, chỉ bao gồm sản phẩm đã xuất bản và chưa bị lưu trữ.

## 3. Expected output

Mỗi dòng gồm:

- `design_code`
- `product_name`: tên sản phẩm.
- `category_name`: tên danh mục.
- `material`
- `created_at`

Sắp xếp theo thời điểm tạo sản phẩm mới nhất trước. Nếu thời gian bằng nhau, sản phẩm có `id` lớn hơn đứng trước.

## 4. Relevant constraints/business rules

- Quan hệ giữa sản phẩm và danh mục được xác định qua khóa ngoại hiện có.
- Danh mục phải được xác định bằng `slug`, không dựa vào `id` hoặc tên hiển thị.
- Sản phẩm đã xuất bản có `status = 'PUBLISHED'`.
- Sản phẩm chưa bị lưu trữ có `archived_at IS NULL`.
- Không trả về ID nội bộ.
- Kết quả tối đa 25 dòng.

## 5. Difficulty

Level 2 — Quan hệ giữa hai bảng.

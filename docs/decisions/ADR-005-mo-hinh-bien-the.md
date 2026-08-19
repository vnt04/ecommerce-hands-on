# ADR-005 — Biến thể là màu × size, mỗi chiều một bảng tra cứu

|            |            |
| ---------- | ---------- |
| Trạng thái | Accepted   |
| Ngày       | 2026-08-20 |
| Bước       | S03        |

## Bối cảnh

Một thiết kế áo bán ra dưới dạng nhiều tổ hợp màu và size, mỗi tổ hợp có giá và tồn kho riêng.
Ba màu năm size là mười lăm SKU cho mỗi thiết kế.

Cách mô hình hoá điều này đi thẳng vào migration đầu tiên của domain sản phẩm và định hình mọi
truy vấn lọc về sau, nên rất đắt để đổi.

Hai thông tin không suy ra được từ tên và bắt buộc phải lưu: mã màu để vẽ swatch, và thứ tự
hiển thị của size — sắp theo tên cho ra `2XL, L, M, S, XL`.

## Các phương án

### A. Bảng `colors` và `sizes` riêng, biến thể giữ hai khoá ngoại — **Chọn**

```sql
SELECT p.slug FROM products p
  JOIN product_variants v ON v.product_id = p.id
  JOIN colors c ON c.id = v.color_id
  JOIN sizes  s ON s.id = v.size_id
WHERE c.name = 'Đen' AND s.name = 'L' AND v.is_active AND v.stock_quantity > 0;
```

### B. Hệ tuỳ chọn tổng quát: `ProductOption` cộng `ProductOptionValue` cộng bảng nối

Thêm thuộc tính mới không cần migration, và mỗi sản phẩm có thể có tập thuộc tính riêng.

Loại vì cùng câu hỏi trên cần bốn join và một mệnh đề đếm để chắc chắn biến thể khớp cả hai
điều kiện:

```sql
... WHERE ov.value IN ('Đen', 'L') GROUP BY p.slug, v.id HAVING count(*) = 2;
```

Mệnh đề `HAVING count(*)` là chỗ dễ viết sai và sai một cách im lặng: quên nó đi thì truy vấn
trả về cả áo màu Đen size S. Ngoài ra một thiết kế cần hai dòng option, tám dòng option value
và ba mươi dòng bảng nối, trong khi phương án A chỉ cần mười lăm dòng biến thể.

### C. Cột chuỗi thẳng trên biến thể

Ít bảng nhất và lọc đơn giản nhất. Loại vì không có chỗ lưu mã màu và thứ tự size: bảng màu
phải hardcode trong frontend, còn sắp xếp size phải viết `CASE` bằng tay ở mọi truy vấn. Thêm
nữa, không gì ngăn được việc gõ `Den` ở sản phẩm này và `Đen` ở sản phẩm kia.

## Quyết định

Hai bảng tra cứu dùng chung toàn hệ thống là `colors` và `sizes`. Bảng `product_variants` giữ
`color_id` và `size_id`, cùng với `sku`, `price`, `stock_quantity`, `weight_grams` và `is_active`.

Ràng buộc duy nhất trên bộ ba `(product_id, color_id, size_id)` ngăn việc sinh trùng tổ hợp.

## Lý do

Phạm vi sản phẩm trong README nói rõ chỉ bán áo thun, và biến thể luôn là màu × size. Lợi thế
thật của phương án B chỉ xuất hiện khi các sản phẩm có tập thuộc tính khác nhau — ví dụ vừa bán
áo có màu và size, vừa bán cốc chỉ có dung tích. Mua khả năng đó ngay bây giờ nghĩa là trả chi
phí phức tạp ở mọi truy vấn về sau để đổi lấy một thứ có thể không bao giờ dùng tới.

## Đánh đổi phải chấp nhận

Thêm chiều thứ ba, ví dụ kiểu tay áo hoặc kiểu cổ, đòi hỏi một migration thêm bảng tra cứu và
thêm một cột khoá ngoại vào `product_variants`, cộng với việc sinh lại toàn bộ SKU đang có —
mà SKU thì không được đổi sau khi đã vào đơn hàng. Nói cách khác, thêm chiều thứ ba sau khi đã
bán hàng là một việc thực sự khó, không phải một migration nhẹ nhàng.

Bảng `colors` và `sizes` dùng chung toàn hệ thống nên không hỗ trợ được trường hợp hai thiết kế
gọi cùng một mã màu bằng hai tên khác nhau.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                                           | Ngưỡng                                                              | Đo bằng                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------- |
| Xuất hiện dòng sản phẩm không phải áo thun, có tập thuộc tính khác | Yêu cầu nghiệp vụ được xác nhận, không phải phỏng đoán              | Phạm vi sản phẩm trong README |
| Cần chiều biến thể thứ ba cho áo thun                              | Yêu cầu nghiệp vụ được xác nhận                                     | Thiết kế tính năng            |
| Truy vấn lọc theo màu và size trở thành điểm nghẽn                 | p95 của endpoint danh sách vượt 300ms và `EXPLAIN` chỉ ra bước join | `pg_stat_statements`          |

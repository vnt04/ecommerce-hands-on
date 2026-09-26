# SQL Gym

Không gian luyện SQL trên chính database ShopFlow trong project. Không tạo schema hay dataset giả
khác cho bài tập.

## Quy trình

1. Mỗi lần chỉ có một bài đang mở.
2. Người học gửi SQL nhưng không xem đáp án trước.
3. Query được review theo tính đúng, chất lượng, hiệu năng và yếu tố production khi phù hợp.
4. Query sai chỉ nhận phân tích lỗi và gợi ý. Đáp án đầy đủ chỉ xuất hiện khi người học yêu cầu
   `show solution`.
5. Các nhận xét đáng nhớ và tiến độ được cập nhật trong [`progress.md`](progress.md).
6. Baseline schema/data dùng để thiết kế bài tập nằm trong [`database-profile.md`](database-profile.md).

## Chạy query từ DBeaver

Các đề bài được lưu trong thư mục [`exercises/`](exercises/):

- [SQLG-001](exercises/SQLG-001.md): đơn chưa thanh toán.
- [SQLG-002](exercises/SQLG-002.md): phân loại khách hàng và ghi chú.
- [SQLG-003](exercises/SQLG-003.md): sản phẩm theo danh mục.
- [SQLG-004](exercises/SQLG-004.md): đơn hàng và tài khoản tùy chọn.
- [SQLG-005](exercises/SQLG-005.md): số đơn và tổng giá trị theo trạng thái.
- [SQLG-006](exercises/SQLG-006.md): khách hàng có nhiều đơn đã thanh toán.
- [SQLG-007](exercises/SQLG-007.md): báo cáo cả khách không có đơn phù hợp.
- [SQLG-008](exercises/SQLG-008.md): biến thể sắp hết hàng theo sản phẩm.
- [SQLG-009](exercises/SQLG-009.md): đơn có nhiều sản phẩm và email tài khoản.
- [SQLG-010](exercises/SQLG-010.md): khách hàng kèm giỏ hàng hết hạn nếu có.

Kết nối PostgreSQL ở `localhost`, database/user/port lấy từ `.env`. Các bảng nghiệp vụ nằm trong
schema `public`.

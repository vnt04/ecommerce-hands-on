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

Kết nối PostgreSQL ở `localhost`, database/user/port lấy từ `.env`. Các bảng nghiệp vụ nằm trong
schema `public`.

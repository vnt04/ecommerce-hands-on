# SQL Gym progress

## Hồ sơ hiện tại

- Bắt đầu: 2026-09-11
- Bài đã giao: 6
- Đã trả lời: 10 attempts
- Đúng: 6
- Sai/cần sửa: 4 attempts
- Cấp độ đang kiểm tra: Level 3 — Aggregation cơ bản

## Bài đang mở

- Không có. `SQLG-006` hoàn thành ở attempt 1 (review logic; chưa chạy database).

## Điểm mạnh có bằng chứng

- Chọn đúng bảng và đúng toàn bộ cột đầu ra được yêu cầu.
- Lọc đúng `payment_status` và có giới hạn 20 dòng.
- SQLG-001 attempt 2: sửa đúng cả khoảng thời gian nửa kín và thứ tự tất định nhiều cột.
- SQLG-002 attempt 1: xử lý đúng hai nullable columns và đặt alias kết quả rõ nghĩa.
- SQLG-003 attempt 1: xác định đúng quan hệ và điều kiện catalog chính.
- SQLG-003 attempt 2: bổ sung đúng filter trên bảng liên quan và alias theo output contract.
- SQLG-004 attempt 2: dùng LEFT JOIN đúng để giữ guest order; kiểm tra thực tế trả về 50 đơn, gồm 10 guest.
- SQLG-005 attempt 1: dùng COUNT, SUM và GROUP BY đúng; giữ đúng phạm vi thời gian và tập đơn.
- SQLG-005 attempt 2: dùng CAST(status AS TEXT) đúng để phân xử theo tên khi số đơn bằng nhau.
- SQLG-006 attempt 1: kết hợp đúng quan hệ orders–users, lọc trước tổng hợp, COUNT/SUM/MAX và HAVING; nhóm theo tài khoản thay vì chỉ theo tên.

## Điểm yếu và lỗi lặp lại

- SQLG-001 attempt 1: sai chiều sắp xếp, khoảng thời gian nhận nhầm biên cuối, và thiếu quy tắc
  phân xử khi `placed_at` bằng nhau. Chưa đủ bằng chứng để coi là lỗi lặp lại.
- SQLG-003 attempt 1: bỏ sót điều kiện xác định category và chưa đặt đúng tên hai cột đầu ra.
- SQLG-004 attempt 1: dùng JOIN chỉ giữ dòng khớp, làm mất đơn có user_id NULL.
- SQLG-005 attempt 1: sắp xếp enum trực tiếp thay vì theo tên trạng thái khi số đơn bằng nhau.

## Những thứ cần note

- Khoảng thời gian theo tháng nên biểu diễn theo dạng nửa kín: nhận biên đầu và loại biên cuối.
- Khi đề bài nói "mới nhất", phải kiểm tra rõ chiều sắp xếp.
- Kết quả dùng `LIMIT` cần thứ tự tất định nếu khóa sắp xếp chính có thể trùng.
- Với quan hệ tùy chọn, kiểm tra loại JOIN có giữ dòng không có bản ghi liên quan hay không.
- SQLG-004: LEFT JOIN giữ đơn không khớp tài khoản và trả NULL cho cột tài khoản; khóa chính users.id bảo đảm mỗi đơn khớp tối đa một user.
- Enum PostgreSQL sắp xếp theo thứ tự khai báo, không tự theo thứ tự chữ cái của nhãn.
- Để sắp xếp theo nhãn enum: PostgreSQL dùng CAST(status AS TEXT); MySQL dùng CAST(status AS CHAR).
- SQLG-006: INNER JOIN theo o.user_id = u.id đã loại guest order, nên o.user_id IS NOT NULL là dư.
- COUNT(column) bỏ qua NULL; COUNT(*) đếm dòng. Trong SQLG-006, o.user_id không NULL sau INNER JOIN nên hai cách cho cùng kết quả.
- WHERE lọc đơn trước tổng hợp; HAVING lọc nhóm sau tổng hợp, nên ngưỡng số đơn PAID được áp dụng đúng.

## Performance và production SQL

- Người học chưa muốn luyện performance ở thời điểm hiện tại. Không dùng việc chưa phân tích plan
  của SQLG-001 để đánh giá năng lực.
- Plan SQLG-001 đã lưu dấu mốc `84.680 ms`; quay lại phân tích khi người học chủ động sẵn sàng.

## Lịch sử

| Bài      | Level | Trạng thái | Chủ đề                               | Nhận xét ngắn                                   |
| -------- | ----: | ---------- | ------------------------------------ | ----------------------------------------------- |
| SQLG-001 |     1 | Hoàn thành | Filter, thời gian, sắp xếp, giới hạn | Đúng ở attempt 2; performance hoãn theo yêu cầu |
| SQLG-002 |     1 | Hoàn thành | NULL, cột dẫn xuất, filter, thứ tự   | Đúng ở attempt 1                                |
| SQLG-003 |     2 | Hoàn thành | Quan hệ product–category             | Đúng ở attempt 2                                |
| SQLG-004 |     2 | Hoàn thành | Đơn hàng và tài khoản tùy chọn       | Đúng ở attempt 2; thực tế 50 dòng gồm 10 guest  |
| SQLG-005 |     3 | Hoàn thành | Báo cáo theo trạng thái              | Đúng ở attempt 2; review logic                  |
| SQLG-006 |     3 | Hoàn thành | Báo cáo khách hàng có nhiều đơn PAID | Đúng ở attempt 1; review logic                  |

# SQL Gym progress

## Hồ sơ hiện tại

- Bắt đầu: 2026-09-11
- Bài đã giao: 4
- Đã trả lời: 7 attempts
- Đúng: 4
- Sai/cần sửa: 3 attempts
- Cấp độ đang kiểm tra: Level 2 — JOIN

## Bài đang mở

- Không có. `SQLG-004` hoàn thành ở attempt 2.

## Điểm mạnh có bằng chứng

- Chọn đúng bảng và đúng toàn bộ cột đầu ra được yêu cầu.
- Lọc đúng `payment_status` và có giới hạn 20 dòng.
- SQLG-001 attempt 2: sửa đúng cả khoảng thời gian nửa kín và thứ tự tất định nhiều cột.
- SQLG-002 attempt 1: xử lý đúng hai nullable columns và đặt alias kết quả rõ nghĩa.
- SQLG-003 attempt 1: xác định đúng quan hệ và điều kiện catalog chính.
- SQLG-003 attempt 2: bổ sung đúng filter trên bảng liên quan và alias theo output contract.
- SQLG-004 attempt 2: dùng LEFT JOIN đúng để giữ guest order; kiểm tra thực tế trả về 50 đơn, gồm 10 guest.

## Điểm yếu và lỗi lặp lại

- SQLG-001 attempt 1: sai chiều sắp xếp, khoảng thời gian nhận nhầm biên cuối, và thiếu quy tắc
  phân xử khi `placed_at` bằng nhau. Chưa đủ bằng chứng để coi là lỗi lặp lại.
- SQLG-003 attempt 1: bỏ sót điều kiện xác định category và chưa đặt đúng tên hai cột đầu ra.
- SQLG-004 attempt 1: dùng JOIN chỉ giữ dòng khớp, làm mất đơn có user_id NULL.

## Những thứ cần note

- Khoảng thời gian theo tháng nên biểu diễn theo dạng nửa kín: nhận biên đầu và loại biên cuối.
- Khi đề bài nói "mới nhất", phải kiểm tra rõ chiều sắp xếp.
- Kết quả dùng `LIMIT` cần thứ tự tất định nếu khóa sắp xếp chính có thể trùng.
- Với quan hệ tùy chọn, kiểm tra loại JOIN có giữ dòng không có bản ghi liên quan hay không.
- SQLG-004: LEFT JOIN giữ đơn không khớp tài khoản và trả NULL cho cột tài khoản; khóa chính users.id bảo đảm mỗi đơn khớp tối đa một user.

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

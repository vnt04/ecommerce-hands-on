# SQL Gym progress

## Hồ sơ hiện tại

- Bắt đầu: 2026-09-11
- Bài đã giao: 10
- Đã trả lời: 19 attempts
- Đúng: 10
- Sai/cần sửa: 9 attempts
- Cấp độ đang kiểm tra: Level 2 — Bài củng cố quan hệ tùy chọn (đã luyện tổng hợp Level 3)

## Bài đang mở

- Không có. `SQLG-010` hoàn thành ở attempt 1 (review logic; chưa chạy database).

## Điểm mạnh có bằng chứng

- SQLG-010 attempt 1: tự chọn đúng LEFT JOIN từ users, đặt điều kiện expires_at trong ON, lọc CUSTOMER trong WHERE và giới hạn đúng tập khách. Bằng chứng tiến bộ sau bài củng cố, chưa kết luận thành thạo mọi trường hợp JOIN.
- SQLG-009 attempt 4: giữ đúng guest bằng LEFT JOIN users và giữ tổng hợp theo đơn đúng. Hướng nối được sửa sau gợi ý trực tiếp, cần kiểm tra lại bằng bài độc lập.
- SQLG-009 attempt 1: tổng hợp theo đơn đúng, phân biệt số dòng và tổng quantity, dùng HAVING đúng, giữ o.total không nhân lên; đủ thứ tự và giới hạn.
- SQLG-008 attempt 2: nhóm theo định danh sản phẩm và sắp xếp đúng p.id; hoàn tất bài củng cố giữ dòng không khớp.
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
- SQLG-007 attempt 1: chọn users làm bảng gốc, dùng LEFT JOIN và COUNT cột phía orders để có thể đếm 0; alias và biên thời gian đúng.
- SQLG-007 attempt 2: sau gợi ý, đặt đúng bộ lọc đơn trong ON, giữ mọi CUSTOMER và sắp xếp theo u.id; chưa coi là bằng chứng tự giải độc lập kỹ năng này.
- SQLG-008 attempt 1: tự đặt đúng bộ lọc biến thể trong ON, giữ sản phẩm không có biến thể phù hợp, đếm cả biến thể tồn kho 0 và trả tổng 0 khi không khớp. Nhóm theo design_code duy nhất nên không gộp sản phẩm trùng tên.

## Điểm yếu và lỗi lặp lại

- SQLG-009 attempt 3: nhầm phía được giữ của RIGHT JOIN; cần bài củng cố hướng LEFT/RIGHT JOIN. RIGHT JOIN users giữ user không có đơn, không giữ đơn không có user; các dòng user không có đơn còn bị phép nối order_items và WHERE loại bỏ.
- SQLG-009 attempt 1: INNER JOIN users làm mất guest (lặp lại SQLG-004); thiếu alias order_total (lặp lại thiếu output alias ở SQLG-003). Cần củng cố kiểm tra quan hệ tùy chọn và tên cột đầu ra.
- SQLG-001 attempt 1: sai chiều sắp xếp, khoảng thời gian nhận nhầm biên cuối, và thiếu quy tắc
  phân xử khi `placed_at` bằng nhau. Chưa đủ bằng chứng để coi là lỗi lặp lại.
- SQLG-003 attempt 1: bỏ sót điều kiện xác định category và chưa đặt đúng tên hai cột đầu ra.
- SQLG-004 attempt 1: dùng JOIN chỉ giữ dòng khớp, làm mất đơn có user_id NULL.
- SQLG-005 attempt 1: sắp xếp enum trực tiếp thay vì theo tên trạng thái khi số đơn bằng nhau.
- SQLG-007 attempt 1: WHERE trên orders loại khách không có đơn phù hợp dù dùng LEFT JOIN; sắp xếp theo o.user_id thay vì u.id. Cần củng cố việc giữ bản ghi không khớp (đã gặp ở SQLG-004, nguyên nhân khác).
- SQLG-008 attempt 1: thiếu ORDER BY. Cần củng cố kiểm tra đầy đủ yêu cầu sắp xếp (đã gặp ở các bài trước).

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
- SQLG-007: điều kiện WHERE trên phía nullable của LEFT JOIN có thể loại dòng cần giữ; CASE trong SELECT không khôi phục dòng đã bị loại.
- Với báo cáo giữ mọi user, khóa sắp xếp cần dựa trên users.id; orders.user_id có thể NULL khi không có đơn phù hợp.
- SQLG-007: COUNT(o.user_id) trả 0 cho dòng không khớp; MAX(o.placed_at) tự trả NULL nên CASE bao quanh MAX là dư. Không thay COUNT cột phía orders bằng COUNT(_) vì dòng giữ lại của user vẫn được COUNT(_) đếm.
- SQLG-007: khi đã nhóm theo u.id, o.user_id là khóa nhóm dư trong phép nối này; mỗi user chỉ có các dòng khớp cùng ID hoặc một dòng không khớp.
- GROUP BY không bảo đảm thứ tự đầu ra; phải có ORDER BY khi đề yêu cầu thứ tự cụ thể.
- SQLG-009: COUNT(o.id) đếm dòng sau khi nối, không đếm đơn duy nhất. Trong query hiện tại, mỗi dòng ứng với một order_item nên cách đếm này đúng; COUNT(oi.id) thể hiện ý định rõ hơn.

## Performance và production SQL

- Người học chưa muốn luyện performance ở thời điểm hiện tại. Không dùng việc chưa phân tích plan
  của SQLG-001 để đánh giá năng lực.
- Plan SQLG-001 đã lưu dấu mốc `84.680 ms`; quay lại phân tích khi người học chủ động sẵn sàng.

## Lịch sử

| Bài      | Level | Trạng thái | Chủ đề                                 | Nhận xét ngắn                                       |
| -------- | ----: | ---------- | -------------------------------------- | --------------------------------------------------- |
| SQLG-001 |     1 | Hoàn thành | Filter, thời gian, sắp xếp, giới hạn   | Đúng ở attempt 2; performance hoãn theo yêu cầu     |
| SQLG-002 |     1 | Hoàn thành | NULL, cột dẫn xuất, filter, thứ tự     | Đúng ở attempt 1                                    |
| SQLG-003 |     2 | Hoàn thành | Quan hệ product–category               | Đúng ở attempt 2                                    |
| SQLG-004 |     2 | Hoàn thành | Đơn hàng và tài khoản tùy chọn         | Đúng ở attempt 2; thực tế 50 dòng gồm 10 guest      |
| SQLG-005 |     3 | Hoàn thành | Báo cáo theo trạng thái                | Đúng ở attempt 2; review logic                      |
| SQLG-006 |     3 | Hoàn thành | Báo cáo khách hàng có nhiều đơn PAID   | Đúng ở attempt 1; review logic                      |
| SQLG-007 |     3 | Hoàn thành | Tổng hợp và khách không có đơn phù hợp | Đúng ở attempt 2 sau gợi ý ON/WHERE; review logic   |
| SQLG-008 |     3 | Hoàn thành | Tổng hợp biến thể sắp hết hàng         | Đúng ở attempt 2; review logic                      |
| SQLG-009 |     3 | Hoàn thành | Báo cáo đơn nhiều sản phẩm, ba bảng    | Đúng ở attempt 4 sau gợi ý hướng JOIN; review logic |
| SQLG-010 |     2 | Hoàn thành | Khách hàng và giỏ hết hạn tùy chọn     | Đúng ở attempt 1; review logic                      |

---
description: Mở bước kế tiếp — tạo docs/steps/S0X-<slug>/ và viết plan + decisions
argument-hint: [tên bước, tiếng Việt — bỏ trống thì lấy bước kế trong lộ trình]
---

Mở bước mới: **$ARGUMENTS**

Làm đúng thứ tự, không nhảy bước:

1. Đọc `CLAUDE.md` và `docs/steps/README.md`. Xác định bước kế tiếp và ID của nó.
2. **Đọc `notes.md` của bước vừa xong** — mục "Cho bước sau" và "Nợ kỹ thuật". Đây là lý do plan bước này chỉ được viết bây giờ chứ không viết từ đầu dự án. Bỏ qua bước này thì mất toàn bộ giá trị của cách làm từng bước.
3. Đọc code hiện có liên quan. Không đoán tên bảng, field, endpoint, script — không tìm thấy thì hỏi.
4. `cp -r docs/steps/_template docs/steps/S0X-<slug>` (slug tiếng Việt không dấu, kebab-case).
5. Điền `plan.md`:
   - Mục tiêu một câu: sau bước này thứ gì chạy được mà trước đó không?
   - **Ngoài phạm vi** — viết kỹ ngang phần trong phạm vi, kèm "để lại cho bước nào".
   - Acceptance criteria: mỗi tiêu chí là **một lệnh hoặc một thao tác cụ thể** kèm kết quả mong đợi. "Hoạt động tốt" bị từ chối.
   - Rủi ro, rollback, và §9 ảnh hưởng tới bước kế.
6. Điền `decisions.md`:
   - §1 chỉ những câu hỏi **bước này thật sự cần**. Mỗi câu kèm 2–3 phương án thật, ưu/nhược, và một khuyến nghị có lý do.
   - §3 liệt kê thứ **cố tình hoãn** kèm hoãn tới bước nào và vì sao hoãn được. Bỏ trống mục này là làm hỏng công dụng chính của file.
   - Quyết định khó đảo ngược → đánh dấu là cần ADR.
7. Điền `tasks.md`, ≤ 20 task. Nhiều hơn → đề xuất cắt đôi bước và hỏi trước.
8. Thêm dòng vào bảng ở `docs/steps/README.md` §3.

Sau đó **DỪNG LẠI**. Tóm tắt cho tôi:
- Mục tiêu và acceptance criteria
- Cái gì cố tình không làm lần này
- Những gì cần tôi chốt (danh sách D1, D2, … kèm khuyến nghị của bạn)
- Rủi ro lớn nhất

Chờ tôi trả lời **CHỐT**. Chưa có chữ CHỐT thì không được sửa file nào ngoài `docs/`.

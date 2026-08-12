---
description: Viết một ADR mới từ template
argument-hint: <chủ đề quyết định>
---

Viết ADR cho: **$ARGUMENTS**

1. Đọc `docs/decisions/README.md`. Kiểm tra chủ đề này đã có ADR nào chưa — nếu có và đang mâu thuẫn, ADR mới phải ghi `Superseded by` vào ADR cũ, **không sửa nội dung ADR cũ**.
2. Kiểm tra ngưỡng: quyết định này có khó đảo ngược không, hay đảo ngược được trong nửa ngày? Nếu là loại thứ hai, nói thẳng là không cần ADR và dừng.
3. `cp docs/decisions/_template.md docs/decisions/ADR-0XX-<slug-khong-dau>.md` với số kế tiếp chưa dùng.
4. Điền đầy đủ. Ba yêu cầu bắt buộc:
   - **Ít nhất 2 phương án thật**, kèm lý do loại. Không bịa phương án cho đủ bảng — không có phương án thay thế đáng cân nhắc thì ghi thẳng như vậy.
   - **Đánh đổi phải chấp nhận** viết rõ. ADR chỉ liệt kê ưu điểm là ADR chưa viết xong.
   - **Điều gì khiến ta xem lại** phải là điều kiện đo được: tín hiệu, ngưỡng, đo bằng công cụ nào, kiểm lại lúc nào.
5. Lý do bám đúng ba tiêu chí ở `README.md`.
6. Cập nhật bảng ở `docs/decisions/README.md` §3.
7. Nếu ADR tạo ra một bất biến mới, thêm dòng vào `CLAUDE.md` §2.2.

Sau đó tóm tắt quyết định trong 3 câu và chờ tôi duyệt trước khi coi trạng thái là `Accepted`.

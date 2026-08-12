# Documentation

Nguyên tắc: **tài liệu nào không có người cập nhật thì đừng tạo.** Tài liệu sai nguy hiểm hơn không có tài liệu, vì người ta tin nó.

---

## 1. Bản đồ tài liệu

| Tài liệu | Là gì | Cập nhật khi |
|---|---|---|
| `README.md` | Giới thiệu sản phẩm + cách chạy dự án | Định vị sản phẩm đổi, hoặc bước setup đổi |
| `CLAUDE.md` | Ràng buộc + quy trình cho AI và người | Thêm ràng buộc/bất biến, đổi quy trình |
| `docs/steps/README.md` | Lộ trình và trạng thái từng bước | Mở bước, đóng bước, đổi thứ tự bước |
| `docs/steps/S0X-*/plan.md` | Mục tiêu, phạm vi, acceptance criteria của một bước | Trước khi bước bắt đầu; sửa giữa chừng thì phải xin CHỐT lại |
| `docs/steps/S0X-*/decisions.md` | Cái gì phải chốt ở bước này, cái gì cố tình hoãn | Trong suốt bước |
| `docs/steps/S0X-*/notes.md` | Nhật ký, bất ngờ, nợ kỹ thuật, số đo | **Trong lúc làm**, không viết lại lúc cuối |
| `docs/rules/*` | Quy tắc làm việc | Rule đổi. **PR riêng**, không nhét vào PR làm bước |
| `docs/decisions/ADR-*.md` | Quyết định khó đảo ngược | Khi ra quyết định. **Không sửa ADR cũ** |
| `docs/architecture/` | Sơ đồ hệ thống thật đang chạy | Từ S09. Kiến trúc thật đổi |
| `docs/runbooks/` | Xử lý sự cố từng bước | Từ S10; và sau mỗi sự cố thật |
| `docs/api/` | OpenAPI **sinh từ code** | Tự động. Cấm sửa tay |
| `docs/archive/` | Tài liệu đã nghỉ hưu, giữ để tra cứu | Chỉ thêm, không sửa |

Thư mục chưa tới lượt thì **chưa tạo**. `docs/runbooks/` rỗng ở S01 là đúng, không phải thiếu sót.

---

## 2. Không có tài liệu thiết kế tổng thể

Dự án này cố ý **không** có một file mô tả toàn bộ hệ thống trước khi xây. Bản kế hoạch tổng thể ban đầu đã nghỉ hưu ở [`docs/archive/plan-v0.md`](../archive/plan-v0.md).

Lý do: một bản thiết kế viết trước khi code sẽ sai ở những chỗ không đoán được, nhưng vì nó đã được viết ra nên người ta vẫn làm theo. Đi từng bước thì mỗi lần chỉ sai một bước, và sai đó sửa được ở bước sau.

Hệ quả về tài liệu:

- **Trạng thái hiện tại** đọc ở `docs/steps/README.md`, không ở đâu khác.
- **Vì sao làm thế này** đọc ở `docs/decisions/`.
- **Sẽ làm gì tiếp** chỉ chi tiết cho một bước kế; xa hơn cố ý mơ hồ.
- `docs/archive/plan-v0.md` là **tham chiếu, không phải nguồn sự thật**. Cấm trích nó như một yêu cầu bắt buộc. Thấy trong đó thứ còn dùng được thì mang vào bước tương ứng, đừng link tới nó trong rule hay plan.

---

## 3. Quy tắc theo loại

### Plan của bước

- Phần "Ngoài phạm vi" quan trọng ngang phần "Trong phạm vi". Không viết ra thì phạm vi sẽ trôi.
- Acceptance criteria phải kiểm được bằng **một lệnh hoặc một thao tác**. "Hoạt động tốt" không phải tiêu chí.
- Plan đã CHỐT mà cần sửa → sửa và xin CHỐT lại, không sửa lặng lẽ.

### decisions.md

- Chỉ liệt kê thứ **bước này thật sự cần**. Chốt sớm là một dạng nợ.
- Mục §3 "Cố tình hoãn" tồn tại để phân biệt *chưa quyết* với *quên mất*. Bỏ trống mục này là làm hỏng công dụng chính của file.

### ADR

Viết khi quyết định khó đảo ngược, **hoặc** khi sáu tháng sau sẽ có người hỏi "sao lại làm thế này?".

ADR **bất biến sau khi merge**. Đổi ý thì viết ADR mới và đánh dấu ADR cũ `Superseded by`. Lịch sử suy nghĩ là phần có giá trị nhất.

Chi tiết: [docs/decisions/README.md](../decisions/README.md).

### OpenAPI

Sinh từ code. Không có file OpenAPI viết tay trong repo. Muốn đổi tài liệu API thì đổi code.

### README

Trả lời hai câu hỏi: *sản phẩm này là gì* và *làm gì để chạy được*. Không nhồi kiến trúc, không nhồi roadmap.

---

## 4. Viết như thế nào

- Tiếng Việt. Câu ngắn, chủ động, không hoa mỹ.
- Ghi **lý do và đánh đổi**, không chỉ ghi kết quả. "Chọn X" vô dụng; "Chọn X vì Y, chấp nhận mất Z" mới dùng được.
- Có số thì ghi số. "Nhanh hơn" vô nghĩa; "p95 400ms → 120ms" là dữ liệu.
- Link tới file/dòng thay vì copy code vào doc. Code copy vào doc sẽ mục.
- Bảng thay cho đoạn văn liệt kê.
- Không viết doc mô tả code làm gì — đọc code nhanh hơn.

---

## 5. Chống doc mục

- PR đụng schema, API contract, hay quy trình vận hành mà không đụng doc tương ứng → reviewer hỏi lý do.
- Đọc doc thấy sai thì **sửa ngay tại chỗ**, không ghi TODO.
- Doc không ai đọc trong 3 tháng và không ai bảo trì → chuyển vào `docs/archive/` hoặc xoá.

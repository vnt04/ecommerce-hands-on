# Architecture Decision Records

## 1. Khi nào viết ADR

Viết khi quyết định **khó đảo ngược**, hoặc khi sáu tháng sau sẽ có người hỏi *"sao lại làm thế này?"*.

| Viết ADR | Không viết ADR |
|---|---|
| Chọn datastore, chọn mô hình dữ liệu cốt lõi | Chọn tên biến, chọn thư viện util nhỏ |
| Kiểu khoá chính, cách lưu tiền, múi giờ | Cách chia component |
| Cách trừ tồn kho, cách chống trùng đơn | Thêm một endpoint theo mẫu đã có |
| SPA hay SSR, cách phục vụ SPA và API | Đổi màu nút |
| Bất cứ thứ gì tạo ra một dòng mới ở `CLAUDE.md` §2.2 | Thứ đảo ngược được trong nửa ngày |

Thà thừa một ADR ngắn còn hơn thiếu ngữ cảnh của một quyết định đắt.

**Kiểm nhanh:** quyết định này sai thì sửa mất bao lâu? Dưới nửa ngày → không cần ADR, ghi vào `decisions.md` của bước là đủ.

---

## 2. Quan hệ với `decisions.md` của bước

| | `docs/steps/S0X-*/decisions.md` | `docs/decisions/ADR-*.md` |
|---|---|---|
| Chứa | Mọi thứ bước đó phải chốt | Chỉ những quyết định khó đảo ngược |
| Tuổi thọ | Đóng lại khi bước xong | Sống suốt đời dự án |
| Sửa sau được không | Được | Không — viết ADR mới |

Luồng: câu hỏi phát sinh → vào `decisions.md` của bước → nếu khó đảo ngược thì **cũng** thành ADR khi chốt.

---

## 3. Quy tắc

- Đặt tên: `ADR-0XX-mo-ta-ngan-khong-dau.md`, số tăng dần, không dùng lại.
- **ADR bất biến sau khi merge.** Đổi ý thì viết ADR mới, đổi trạng thái ADR cũ thành `Superseded by ADR-0YY`. Không sửa nội dung ADR cũ — lịch sử suy nghĩ là phần có giá trị nhất.
- ADR nằm trong **cùng PR** với code hiện thực quyết định đó.
- Mục **"Điều gì khiến ta xem lại"** là bắt buộc, và phải đo được. Đây là mục quan trọng nhất và hay bị bỏ nhất — ADR không có điều kiện xem lại sẽ sống mãi kể cả khi đã sai.
- ADR tạo ra bất biến kỹ thuật → thêm một dòng vào `CLAUDE.md` §2.2.

Trạng thái: `Proposed` → `Accepted` → `Superseded by ADR-0YY` / `Deprecated`.

---

## 4. Danh sách

| ADR | Chủ đề | Trạng thái |
|---|---|---|
| — | _(chưa có)_ | |

**Chưa có ADR nào là đúng.** S01 (nền móng repo) không chứa quyết định nào khó đảo ngược — cả 6 quyết định của nó sửa được trong một buổi.

ADR đầu tiên dự kiến xuất hiện ở **S02**, khi phải chốt kiểu khoá chính, cách lưu tiền, và múi giờ — ba thứ đi vào migration đầu tiên và rất đắt để đổi sau.

---

## 5. Template

[`_template.md`](_template.md)

```bash
cp docs/decisions/_template.md docs/decisions/ADR-00X-mo-ta-ngan.md
```

hoặc `/adr-new`.

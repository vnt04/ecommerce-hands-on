# ADR-0XX — <Quyết định, viết ở thể khẳng định>

| | |
|---|---|
| **Trạng thái** | Proposed / Accepted / Superseded by ADR-0YY / Deprecated |
| **Ngày** | YYYY-MM-DD |
| **Bước liên quan** | S0X |
| **Bất biến tạo ra** | Dòng thêm vào `CLAUDE.md` §2.2 — hoặc "không" |

---

## Bối cảnh

Tình huống buộc phải quyết. Ràng buộc thật: quy mô, ngân sách, số người vận hành, thời gian.

Viết đủ để sáu tháng sau người đọc hiểu được vì sao đây từng là một câu hỏi khó — chứ không phải hiển nhiên.

## Các phương án

### A. <tên> — **Chọn**

Mô tả ngắn. Ưu. Nhược.

### B. <tên>

Mô tả ngắn. Ưu. Nhược. **Loại vì**: …

### C. <tên>

Mô tả ngắn. Ưu. Nhược. **Loại vì**: …

## Quyết định

Một đoạn, dứt khoát. "Chúng ta sẽ …"

## Lý do

Vì sao A thắng, dựa trên đúng ba tiêu chí ở [README.md](../../README.md):

1. Đơn hàng và tiền phải đúng → …
2. Một người vận hành được → …
3. Chi phí tương xứng lưu lượng thật → …

## Đánh đổi phải chấp nhận

Cái mất, ghi thẳng. ADR chỉ liệt kê ưu điểm là ADR chưa viết xong.

- …
- …

## Hệ quả

Cái gì phải làm theo sau quyết định này (code, hạ tầng, quy trình, tài liệu).

- …

## Điều gì sẽ khiến ta xem lại quyết định này

**Bắt buộc.** Ghi điều kiện **đo được**, không ghi cảm tính.

| Tín hiệu | Ngưỡng | Đo bằng | Kiểm lại khi nào |
|---|---|---|---|
| … | … | … | … |

Ví dụ: *trang sản phẩm không được Google index sau 4–8 tuần chạy thật, đo bằng Search Console → chuyển sang prerender lúc build.*

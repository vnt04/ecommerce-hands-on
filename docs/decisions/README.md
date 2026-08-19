# Architecture Decision Records

Ghi lại các quyết định **khó đảo ngược**, hoặc quyết định mà sáu tháng sau sẽ có người hỏi
"sao lại làm thế này?".

Mỗi ADR bất biến sau khi đã chấp nhận. Đổi ý thì viết ADR mới và đánh dấu ADR cũ là
`Superseded by`. Lịch sử suy nghĩ là phần có giá trị nhất, sửa đè lên là mất.

Mục **Điều gì sẽ khiến ta xem lại** là bắt buộc và phải đo được. ADR không có điều kiện xem
lại sẽ sống mãi kể cả khi đã sai.

| ADR                                           | Chủ đề                                              | Trạng thái | Bước |
| --------------------------------------------- | --------------------------------------------------- | ---------- | ---- |
| [ADR-001](ADR-001-khoa-chinh-tu-tang.md)      | Khoá chính là số nguyên tự tăng                     | Accepted   | S02  |
| [ADR-002](ADR-002-dinh-danh-cong-khai.md)     | Thực thể lộ ra URL có định danh công khai riêng     | Accepted   | S02  |
| [ADR-003](ADR-003-luu-tien-bang-so-nguyen.md) | Tiền lưu số nguyên đơn vị đồng, JSON dạng chuỗi     | Accepted   | S02  |
| [ADR-004](ADR-004-thoi-gian-timestamptz.md)   | Thời gian lưu `timestamptz`, nghiệp vụ giờ Việt Nam | Accepted   | S02  |

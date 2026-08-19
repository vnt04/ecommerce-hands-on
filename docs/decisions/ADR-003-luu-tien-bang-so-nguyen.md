# ADR-003 — Tiền lưu bằng số nguyên đơn vị đồng, truyền qua JSON dạng chuỗi

|            |                    |
| ---------- | ------------------ |
| Trạng thái | Accepted           |
| Ngày       | 2026-08-19         |
| Bước       | S02                |
| Ràng buộc  | R1 trong CLAUDE.md |

## Bối cảnh

VND không có đơn vị nhỏ hơn đồng, nên mọi số tiền trong hệ thống là số nguyên. Câu hỏi thật
không phải "lưu kiểu gì" mà là **làm sao ngăn một phép chia biến số nguyên thành số thực**:
chia phí vận chuyển cho ba món hàng, tính VAT, chia khuyến mãi theo tỉ lệ — mỗi chỗ đều là
một cơ hội để phần lẻ lọt vào.

Thêm một ràng buộc kỹ thuật: `JSON.stringify` **ném lỗi** khi gặp `bigint`.

## Các phương án

### A. `BIGINT` ở database, `bigint` ở TypeScript, `string` trong JSON — **Chọn**

### B. `BIGINT` ở database, `number` ở TypeScript, `number` trong JSON

Đơn giản nhất cho frontend. Số tiền của một cửa hàng áo thun không bao giờ chạm trần an toàn
của `number` là 9.007.199.254.740.991 đồng, nên về giá trị thì chạy được.

Loại vì `number` là kiểu số thực: `10000 / 3` cho `3333.3333333333335` mà trình biên dịch
không phàn nàn. Ràng buộc R1 vỡ âm thầm, và chỉ lộ ra khi ai đó đối soát sổ sách.

### C. `DECIMAL` ở database, thư viện số thập phân ở TypeScript

Chuẩn cho tiền tệ có phần lẻ. Loại vì VND không có phần lẻ, nên đây là mua thêm phức tạp để
biểu diễn thứ không tồn tại.

## Quyết định

`BIGINT` ở database, `bigint` ở TypeScript, chuỗi chữ số trong JSON.

Phép chuyển đổi định nghĩa một lần duy nhất trong `@shopflow/shared` (`vndFromJson`,
`vndToJson`), và được gắn vào tầng serialize của Express qua một replacer toàn cục nên không
endpoint nào phải tự nhớ gọi.

## Lý do

`bigint` không có phép chia ra số thực: `10000n / 3n` cho `3333n`. Trình biên dịch **chặn**
việc trộn `bigint` với `number`. Ràng buộc R1 được bảo vệ bằng hệ thống kiểu thay vì bằng
kỷ luật của người viết mã.

Chọn `string` thay vì `number` trên đường truyền: vì `JSON.stringify` ném lỗi với `bigint`,
bắt buộc phải có bước chuyển đổi dù chọn gì. `number` không tiết kiệm được công sức nào mà
lại mở lại đúng cánh cửa vừa đóng.

## Đánh đổi phải chấp nhận

Frontend nhận `"299000"` chứ không phải `299000`, nên phải chuyển đổi trước khi tính toán.
Giảm nhẹ bằng schema dùng chung, nhưng vẫn là một bước người mới vào dự án phải học.

Số tiền trong log và trong công cụ xem database hiển thị dạng chuỗi, đọc hơi lạ mắt.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                                   | Ngưỡng                                                  | Đo bằng           |
| ---------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| Bán sang thị trường có đơn vị tiền tệ nhỏ hơn              | Xuất hiện yêu cầu đa tiền tệ                            | Yêu cầu nghiệp vụ |
| Chi phí chuyển đổi `bigint` gây nghẽn ở endpoint danh sách | p95 vượt 300ms và hồ sơ hiệu năng chỉ ra bước serialize | Profiling         |

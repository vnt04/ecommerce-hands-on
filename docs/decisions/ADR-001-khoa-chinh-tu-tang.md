# ADR-001 — Khoá chính là số nguyên tự tăng

|            |            |
| ---------- | ---------- |
| Trạng thái | Accepted   |
| Ngày       | 2026-08-19 |
| Bước       | S02        |

## Bối cảnh

Mọi bảng cần một khoá chính, và lựa chọn này đi vào migration đầu tiên nên rất đắt để đổi
về sau: đổi kiểu khoá chính kéo theo đổi toàn bộ khoá ngoại trỏ tới nó.

Ràng buộc thực tế: một database duy nhất, một region, quy mô vài trăm thiết kế và vài nghìn
đơn mỗi tháng. Không có nhu cầu sinh id ở phía client, không có kế hoạch gộp dữ liệu từ
nhiều nguồn.

## Các phương án

### A. `BIGSERIAL` tự tăng — **Chọn**

Khoá 8 byte, ghi tuần tự nên chỉ chèn vào cuối B-tree.

### B. UUID v4

Sinh được ở phía client, không lộ thông tin. Loại vì: 16 byte cho mỗi khoá chính và mỗi
khoá ngoại, và giá trị ngẫu nhiên làm B-tree phân mảnh do mỗi lần chèn rơi vào một trang khác nhau.

### C. UUID v7

Giữ được tính tuần tự theo thời gian nên tránh được phân mảnh của v4. Loại vì: vẫn gấp đôi
dung lượng khoá, và lợi thế thật của nó — sinh id trước khi ghi database, gộp dữ liệu đa
nguồn — đều là thứ dự án này không cần.

## Quyết định

Mọi bảng dùng `BIGSERIAL` làm khoá chính. Khoá chính chỉ dùng nội bộ: khoá ngoại, join, thứ tự.

## Lý do

Xét theo ba tiêu chí trong README:

1. **Đơn hàng và tiền phải chính xác** — không có khác biệt giữa các phương án.
2. **Một người vận hành được** — khi khách gọi điện hỏi về đơn hàng, đọc một số nguyên qua
   điện thoại làm được, đọc UUID thì không.
3. **Chi phí tương xứng** — khoá nhỏ hơn nghĩa là index nhỏ hơn, nằm vừa trong bộ nhớ lâu hơn.

## Đánh đổi phải chấp nhận

Id tuần tự lộ sản lượng: ai đặt hai đơn cách nhau một tuần và so hai id sẽ ước lượng được
số đơn bán ra trong tuần đó. Ràng buộc R7 chặn việc đọc dữ liệu của người khác nhưng không
chặn việc đếm.

Đánh đổi này được xử lý bằng [ADR-002](ADR-002-dinh-danh-cong-khai.md), không phải bằng cách
chấp nhận rủi ro.

Ngoài ra: không sinh được id trước khi ghi, nên mọi thao tác cần id phải chờ database trả về.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                    | Ngưỡng                                                                          | Đo bằng            |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| Cần ghi từ nhiều database rồi gộp lại       | Xuất hiện nhu cầu thật, không phải dự đoán                                      | Yêu cầu nghiệp vụ  |
| Cần sinh id ở phía client trước khi gửi lên | Xuất hiện trong một tính năng cụ thể                                            | Thiết kế tính năng |
| Bảng vượt 2 tỷ bản ghi                      | `BIGSERIAL` còn dư rất xa, nhưng nếu dùng `SERIAL` 4 byte ở đâu đó thì phải đổi | `SELECT max(id)`   |

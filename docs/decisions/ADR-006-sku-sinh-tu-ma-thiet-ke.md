# ADR-006 — SKU sinh từ mã thiết kế, không sinh từ tên sản phẩm

|            |                    |
| ---------- | ------------------ |
| Trạng thái | Accepted           |
| Ngày       | 2026-08-20         |
| Bước       | S03                |
| Ràng buộc  | R8 trong CLAUDE.md |

## Bối cảnh

Mỗi biến thể cần một mã định danh ổn định, xuất hiện trên nhãn hàng hoá, trong đơn hàng và
trong báo cáo bán theo size.

Ràng buộc R8 nói không xoá cứng dữ liệu đã xuất hiện trong đơn hàng. Điều tương tự áp dụng cho
SKU: một SKU đã nằm trong đơn cũ mà bị đổi nghĩa thì lịch sử đơn hàng nói dối.

Ba màu năm size là mười lăm SKU cho mỗi thiết kế.

## Các phương án

### A. Sinh tự động từ mã thiết kế do admin nhập — **Chọn**

`TEE-SUNSET` cộng `BLK` cộng `L` cho `TEE-SUNSET-BLK-L`.

### B. Sinh tự động từ tên sản phẩm

Admin không phải nhập thêm gì. Loại vì tên sản phẩm là thứ admin sửa thường xuyên: đổi
"Tee Sunset" thành "Tee Hoàng Hôn" làm SKU cũ lệch hẳn với tên hiện tại. Giữ SKU cũ thì gây khó
hiểu, đổi SKU thì vi phạm R8. Không có lối thoát nào tốt.

### C. Admin nhập tay từng SKU

Kiểm soát tối đa, và khớp được với mã có sẵn của xưởng in. Loại vì mười lăm SKU cho mỗi thiết
kế nhập tay là mời gọi sai sót: gõ nhầm một ký tự sinh ra một SKU không ai phát hiện cho tới
khi soạn hàng sai.

## Quyết định

`products` có cột `design_code` unique, do admin nhập, chỉ chấp nhận chữ in hoa, chữ số và dấu
gạch nối ở giữa.

SKU ghép theo công thức `{design_code}-{color.code}-{size.name}`, sinh bằng một hàm thuần và
tất định trong tầng domain. Hàm từ chối mã thiết kế không hợp lệ thay vì sinh ra SKU hỏng.

## Lý do

Tách mã thiết kế khỏi tên hiển thị là điểm mấu chốt: tên là thứ dành cho khách và thay đổi theo
nhu cầu tiếp thị, mã thiết kế là thứ dành cho vận hành và không đổi. Nhờ vậy R8 được giữ mà
không phải cấm admin đổi tên sản phẩm.

Sinh tự động thay vì nhập tay loại bỏ hẳn lớp lỗi gõ nhầm, và làm cho SKU có thể dự đoán được —
nhìn `TEE-SUNSET-NVY-2XL` là biết ngay đó là gì mà không cần tra database.

## Đánh đổi phải chấp nhận

Admin phải nghĩ ra mã thiết kế khi tạo sản phẩm, và mã đó không sửa được sau khi đã có đơn hàng.
Đặt nhầm mã ngay từ đầu là một sai lầm khó sửa.

Mã màu bị giới hạn ở dạng ngắn không dấu, nên bảng `colors` cần cả `code` cho SKU lẫn `name`
cho khách xem — hai cột cho cùng một khái niệm.

Đổi tên một màu trong bảng `colors` không làm đổi SKU đã sinh, nên có thể tồn tại SKU chứa
`BLK` trong khi màu đã được đổi tên. Đây là hệ quả có chủ đích: SKU ổn định quan trọng hơn tính
nhất quán về mặt hiển thị.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                    | Ngưỡng                                                                   | Đo bằng                   |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| Xưởng in yêu cầu dùng hệ mã riêng của họ    | Yêu cầu được xác nhận                                                    | Trao đổi với nhà cung cấp |
| Admin thường xuyên phải đặt lại mã thiết kế | Từ ba lần trở lên trong một quý                                          | Nhật ký thao tác quản trị |
| Cần thêm chiều biến thể thứ ba              | Xem [ADR-005](ADR-005-mo-hinh-bien-the.md) — công thức SKU phải đổi theo | Thiết kế tính năng        |

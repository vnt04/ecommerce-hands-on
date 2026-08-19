# ADR-004 — Thời gian lưu `timestamptz`, nghiệp vụ tính theo giờ Việt Nam

|            |            |
| ---------- | ---------- |
| Trạng thái | Accepted   |
| Ngày       | 2026-08-19 |
| Bước       | S02        |

## Bối cảnh

Hai câu hỏi khác nhau hay bị gộp làm một:

1. **Lưu trữ** — cột dùng kiểu có kèm múi giờ hay không.
2. **Nghiệp vụ** — báo cáo "doanh thu theo ngày" cắt ngày theo múi giờ nào.

Trả lời sai câu thứ hai thì mọi con số doanh thu lệch mà không có dấu hiệu gì: đơn đặt lúc
1 giờ sáng giờ Việt Nam bị tính sang ngày hôm trước nếu cắt theo UTC.

Việt Nam không áp dụng giờ mùa hè, nên lớp lỗi khó chịu nhất của thời gian không tồn tại ở đây.

## Các phương án

### A. `timestamptz`, nghiệp vụ tính theo `Asia/Ho_Chi_Minh` — **Chọn**

### B. `timestamp` không kèm múi giờ, lưu thẳng giờ Việt Nam

Đọc dữ liệu thô trong database thấy đúng giờ địa phương, không phải quy đổi. Loại vì giá trị
đã lưu không mang thông tin về múi giờ nào đã sinh ra nó: đổi múi giờ của máy chủ hoặc container
là dữ liệu mới lệch so với dữ liệu cũ mà không có cách nào phân biệt.

### C. `timestamptz`, nghiệp vụ tính theo UTC

Đơn giản nhất về kỹ thuật. Loại vì báo cáo sẽ sai so với cảm nhận của người vận hành, và sai
đúng vào khung 00:00 tới 07:00 giờ Việt Nam.

## Quyết định

Mọi cột thời gian dùng `timestamptz`. PostgreSQL chuẩn hoá về UTC khi lưu.

Mọi phép cắt theo ngày, tuần, tháng phục vụ báo cáo phải nêu múi giờ tường minh:

```sql
date_trunc('day', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
```

Cấm dùng `date_trunc` trần trên cột thời gian trong truy vấn báo cáo.

## Lý do

`timestamptz` giữ được ý nghĩa tuyệt đối của một mốc thời gian, nên dữ liệu cũ không bao giờ
đổi nghĩa khi hạ tầng đổi. Việc quy đổi sang giờ địa phương là lo lắng của tầng hiển thị và
tầng báo cáo, đúng nơi nó thuộc về.

## Đánh đổi phải chấp nhận

Người đọc database trực tiếp thấy giờ UTC, lệch 7 tiếng so với giờ Việt Nam, dễ nhầm khi
truy sự cố.

Mỗi truy vấn báo cáo dài thêm một mệnh đề `AT TIME ZONE`. Quên là sai số liệu mà không có
thông báo lỗi — đây là rủi ro thật, cần bắt trong review.

## Điều gì sẽ khiến ta xem lại

| Tín hiệu                                       | Ngưỡng                        | Đo bằng                                         |
| ---------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Bán ở thị trường có nhiều múi giờ              | Xuất hiện yêu cầu nghiệp vụ   | Yêu cầu nghiệp vụ                               |
| Việt Nam áp dụng giờ mùa hè                    | Thay đổi pháp luật            | Thông báo chính thức                            |
| Xuất hiện truy vấn báo cáo quên `AT TIME ZONE` | Bất kỳ lần nào lọt qua review | Review, và đối chiếu số liệu với người vận hành |

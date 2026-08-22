# CLAUDE.md

Hướng dẫn làm việc trong repository ShopFlow. Mô tả sản phẩm: [README.md](README.md).

## 1. Ràng buộc bắt buộc

Vi phạm các ràng buộc dưới đây được xem là lỗi, không phải lựa chọn thiết kế.

| #   | Ràng buộc                                                   | Lý do                                                           |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| R1  | Mọi số tiền là số nguyên, đơn vị đồng                       | VND không có đơn vị nhỏ hơn đồng. Số thực gây sai lệch tích luỹ |
| R2  | Không bán vượt tồn kho                                      | Bán hàng không có sẵn dẫn tới huỷ đơn                           |
| R3  | Không tạo trùng đơn khi client gửi lại yêu cầu              | Trừ tiền và trừ tồn kho hai lần                                 |
| R4  | Thay đổi giá không làm thay đổi tổng tiền của đơn đã đặt    | Đơn hàng là cam kết tại thời điểm đặt                           |
| R5  | Không lưu trữ hoặc xử lý dữ liệu thẻ thanh toán             | Sử dụng hosted checkout của cổng thanh toán                     |
| R6  | Không đưa secret vào repository, image hoặc bundle frontend | Biến build của Vite nằm trong tệp tải về máy khách              |
| R7  | Mọi kiểm tra quyền được thực hiện lại ở backend             | SPA chạy trên máy người dùng, không tin cậy được                |
| R8  | Không xoá cứng dữ liệu đã xuất hiện trong đơn hàng          | Làm hỏng lịch sử đơn                                            |

Ràng buộc kỹ thuật phát sinh trong quá trình triển khai được bổ sung vào bảng này khi bước tương ứng chốt quyết định.

## 2. Quy trình

1. Đọc tài liệu của bước đang thực hiện trong `docs/steps/` trước khi bắt đầu.
2. Chỉ thực hiện các hạng mục thuộc phạm vi công việc của bước. Hạng mục nằm ngoài phạm vi phải được thống nhất trước.
3. Không quyết định trước những vấn đề bước hiện tại chưa cần. Vấn đề chưa cần lời giải được ghi nhận, không tự chọn phương án.
4. Mỗi hạng mục chỉ được xem là hoàn thành khi tiêu chí nghiệm thu tương ứng được kiểm chứng bằng lệnh chạy thực tế, có output kèm theo.
5. Không tuyên bố hoàn thành khi chưa có kết quả kiểm chứng.
6. Mọi vấn đề cần người quyết phải được trình bày dưới dạng **danh sách phương án chọn được**, kèm phương án đề xuất và cơ sở của đề xuất. Không trình bày quyết định dưới dạng văn xuôi hoặc câu hỏi mở. Giới hạn mỗi lượt là 4 vấn đề, mỗi vấn đề 2–4 phương án; nhiều hơn thì chia thành nhiều lượt theo thứ tự ưu tiên.
7. **Không tự động tạo commit.** Chỉ chạy `git commit` khi được yêu cầu rõ ràng. Áp dụng tương tự cho các thao tác ghi lên remote: `git push`, `git push --force`, xoá nhánh. Sau khi hoàn thành công việc thì báo cáo thay đổi và chờ yêu cầu, không tự chốt lại bằng commit.
8. **Sửa mã thì làm trên nhánh riêng.** Trước khi sửa, tạo nhánh từ `main` theo dạng `<type>/<mô-tả-ngắn>`, dùng chung bộ `type` với commit message. Không commit thẳng vào `main`. Đang có sẵn nhánh cho đúng công việc đó thì làm tiếp trên nhánh đó, không tạo thêm nhánh mới.

Dừng lại và hỏi khi: cần thêm hoặc gỡ dependency, cần thay đổi lược đồ dữ liệu, cần thay đổi API contract, phát hiện tài liệu của bước không khớp thực tế, hoặc cách nhanh nhất để test đạt là sửa test.

## 3. Môi trường

Mã nguồn đặt tại `/Users/designerfour/Documents/nghiepdev/ecommerce-hands-on` trên macOS. Lệnh phát triển chạy trực tiếp, không qua lớp bọc nào.

Docker Desktop tự ánh xạ uid nên `DOCKER_UID` và `DOCKER_GID` trong `.env` không có tác dụng ở đây. Bind mount của macOS không phát sinh sự kiện inotify đáng tin cậy, nên hot reload cần `WATCH_POLLING=true`.

Lệnh Prisma cần kết nối thật phải chạy trong container, vì `DATABASE_URL` trong `.env` cố ý không chứa mật khẩu — xem phần quyết định trong `docs/steps/S08.md`:

```bash
docker compose exec -w /app/apps/api api pnpm exec prisma <lệnh>
```

Danh sách lệnh của dự án nằm trong `README.md`. Không suy đoán tên script.

## 4. Quy ước ngôn ngữ

| Đối tượng                                                                       | Ngôn ngữ   |
| ------------------------------------------------------------------------------- | ---------- |
| Tài liệu, chú thích giải thích lý do                                            | Tiếng Việt |
| Định danh trong mã nguồn, trường API, cột cơ sở dữ liệu, mã lỗi, commit message | Tiếng Anh  |
| Thông báo lỗi trả về client, nội dung hiển thị cho người dùng                   | Tiếng Việt |

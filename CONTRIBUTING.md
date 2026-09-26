# Đóng góp cho ShopFlow

Cách chạy và kiểm tra dự án nằm trong [README](README.md) và
[hướng dẫn phát triển](docs/development.md).

## Thay đổi mã nguồn

Tạo nhánh riêng từ `main`, đặt tên theo dạng `<type>/<mo-ta-ngan>`, ví dụ
`feat/order-history` hoặc `fix/cart-quantity`.

Giữ đúng các ràng buộc nghiệp vụ: tiền là số nguyên đồng, không bán vượt tồn,
không tạo trùng đơn khi gửi lại yêu cầu, không thay đổi dữ liệu đơn cũ khi sửa sản
phẩm và kiểm tra quyền ở backend. Không commit secret hoặc tệp `.env`.

Tài liệu, chú thích giải thích lý do và thông báo cho người dùng dùng tiếng Việt;
định danh mã nguồn, trường API và commit message dùng tiếng Anh.

## Commit và kiểm tra

Dùng Conventional Commits:

```text
feat(api): add order history
fix(web): correct cart quantity
docs: simplify project introduction
```

Hook pre-commit chạy lint-staged: ESLint cho mã JS/TS/Vue, Prettier cho các định dạng
được cấu hình và secretlint cho tệp đã stage. Hook commit-msg chạy commitlint.

Trước khi gửi thay đổi, chạy các kiểm tra phù hợp được liệt kê trong
[README](README.md#kiểm-thử). Với thay đổi nghiệp vụ/database, chạy thêm integration
test. PR mô tả vấn đề, hành vi sau sửa và kết quả kiểm chứng; cập nhật tài liệu khi
thay đổi cách sử dụng hoặc quyết định thiết kế.

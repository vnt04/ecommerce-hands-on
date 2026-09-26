# Thiết kế kỹ thuật ShopFlow

ShopFlow quản lý áo thun in sẵn theo thiết kế, màu và size. Tài liệu mô tả cách
các thành phần phối hợp, các ràng buộc nghiệp vụ và phạm vi kiểm thử trong mã nguồn.
Cách khởi động và cấu hình môi trường nằm trong [hướng dẫn phát triển](development.md).

## 1. Kiến trúc ứng dụng

Backend là một ứng dụng NestJS gồm các module Auth, Catalog, Cart và Orders,
chia sẻ PostgreSQL qua Prisma. Cách tổ chức này giữ ranh giới nghiệp vụ trong mã
nguồn và cho phép đặt hàng, trừ tồn, xóa giỏ trong cùng một database transaction.
Đổi lại, các module được build và triển khai cùng nhau.

Frontend Vue gọi API qua `/api/v1`. Trong môi trường phát triển, Vite proxy tới
API container. Redis lưu bộ đếm rate limit; MinIO cung cấp giao thức S3 cho ảnh.
Redis không tham gia transaction đơn hàng và không phải nơi lưu tồn kho.

[AppModule](../apps/api/src/app.module.ts) cấu hình thứ tự guard: rate limit,
xác thực, rồi phân quyền. Log HTTP có request ID để đối chiếu lỗi; các header
chứa thông tin xác thực được loại khỏi log.

`packages/shared` chứa schema Zod, kiểu hợp đồng và hàm xử lý tiền. Backend dùng
schema để kiểm tra dữ liệu vào; tài liệu OpenAPI kết hợp schema với decorator API.
Frontend sử dụng các kiểu dùng chung. Kiểu TypeScript giúp phát hiện sai lệch khi
biên dịch nhưng không thay thế kiểm tra dữ liệu tại runtime.

## 2. Mô hình dữ liệu và tiền

Một thiết kế có nhiều biến thể; mỗi biến thể giữ một màu, một size, giá và tồn kho.
Cặp màu × size là duy nhất trong một sản phẩm. SKU sinh từ mã thiết kế, mã màu và
size, ví dụ `TEE-SUNSET-BLK-L`, nên đổi tên hiển thị không làm đổi SKU.

Mô hình này hỗ trợ trực tiếp lọc theo màu/size và quản lý tồn từng tổ hợp. Đánh đổi
là thêm một chiều biến thể mới sẽ cần thay đổi mô hình, thay vì chỉ thêm cấu hình.
Sản phẩm ngừng bán được lưu trữ; biến thể có thể bị tắt, vẫn giữ liên kết với đơn cũ.

| Dữ liệu    | Cách biểu diễn                                              | Hệ quả                                                             |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Khóa chính | Số nguyên tự tăng, dùng nội bộ                              | URL sản phẩm dùng slug; đơn hàng dùng mã riêng                     |
| Tiền VND   | PostgreSQL `BIGINT`, TypeScript `bigint`, JSON chuỗi chữ số | Không dùng số thực cho phép tính tiền; cần chuyển đổi khi hiển thị |
| Thời gian  | `timestamptz`; ngày cấp mã đơn theo giờ Việt Nam            | Phân biệt thời điểm lưu trữ với ngày nghiệp vụ                     |
| Dòng đơn   | Lưu tên, SKU, màu, size, đơn giá và thành tiền tại lúc mua  | Sửa catalog không làm thay đổi dữ liệu đơn đã đặt                  |

Database bổ sung `UNIQUE` và `CHECK` cho các bất biến như SKU duy nhất, tồn không
âm, số lượng dương và tổng tiền hợp lệ. Một số ràng buộc được viết trực tiếp trong
migration SQL vì Prisma schema không biểu diễn đầy đủ chúng.

Nguồn: [Prisma schema](../apps/api/prisma/schema.prisma),
[migrations](../apps/api/prisma/migrations/),
[hàm xử lý tiền](../packages/shared/src/money.ts),
[logic SKU](../apps/api/src/modules/catalog/domain/sku.ts).

## 3. Xác thực và trạng thái frontend

Mật khẩu được băm bằng bcrypt. Access token là JWT có thời hạn 15 phút, chỉ giữ
trong bộ nhớ frontend. Refresh token nằm trong cookie `HttpOnly`, `SameSite=Lax`,
giới hạn path `/api/v1/auth`; bật `Secure` ở production. Database lưu hash của
refresh token cùng họ token và thời hạn.

Khi refresh, backend thu hồi token cũ và cấp token mới. Nếu nhận lại token đã bị
thu hồi, backend thu hồi cả họ token. Client dùng một Promise chung để gộp các
lần refresh đang chạy trong cùng ứng dụng, rồi thử lại request một lần. Tải lại
trang sẽ khôi phục phiên qua refresh token.

Guard kiểm chữ ký JWT và đọc vai trò trong token, không truy vấn user cho mỗi
request. Đánh đổi là việc thu hồi refresh token hoặc đổi vai trò không làm access
token đã cấp mất hiệu lực ngay; token đó còn hiệu lực tới khi hết hạn.
Cơ chế gộp refresh phía client nằm trong bộ nhớ của từng tab, không đồng bộ giữa các tab.

Pinia giữ trạng thái phiên; TanStack Query quản lý dữ liệu API. Khi danh tính đổi,
giao diện vô hiệu hóa cache giỏ hàng để tải giỏ tương ứng. Route guard hỗ trợ điều
hướng; quyền quản trị và quyền đọc đơn được kiểm tra lại phía backend.

Nguồn: [AuthService](../apps/api/src/modules/auth/auth.service.ts),
[guards](../apps/api/src/modules/auth/auth.guards.ts),
[API client](../apps/web/src/api/client.ts), [App.vue](../apps/web/src/App.vue).
Kiểm thử: [auth](../apps/api/src/modules/auth/auth.service.int.test.ts),
[API client](../apps/web/src/api/client.test.ts).

## 4. Giỏ hàng

Giỏ khách chưa đăng nhập được nhận diện bằng cookie; giỏ tài khoản gắn với user.
Khi đăng nhập, hệ thống gộp các dòng theo biến thể, giới hạn số lượng theo tồn đọc
được, ghi các dòng vào giỏ tài khoản và xóa giỏ ẩn danh trong transaction.
Ràng buộc duy nhất trên cặp giỏ/biến thể ngăn tạo hai dòng cho cùng một SKU.

Giỏ không giữ chỗ tồn kho. Giới hạn số lượng khi thêm chỉ phản ánh tồn tại thời
điểm đọc; bước đặt hàng phải kiểm tra và trừ tồn lại. `priceWhenAdded` dùng phát
hiện giá thay đổi, còn giá mua được lấy từ catalog khi tạo đơn.

Đánh đổi là khách có thể thêm hàng thành công nhưng gặp hết hàng khi đặt. Cách này
không cần cơ chế giữ chỗ và giải phóng tồn cho những giỏ bị bỏ dở. Transaction và
ràng buộc duy nhất không tự chứng minh mọi trường hợp sửa/gộp giỏ đồng thời đều
được tuần tự hóa.

Nguồn: [CartService](../apps/api/src/modules/cart/cart.service.ts).
Kiểm thử: [giỏ hàng](../apps/api/src/modules/cart/cart.service.int.test.ts).

## 5. Đặt hàng và tồn kho

### Tạo đơn

`OrdersService.placeOrder` thực hiện trong một transaction:

1. Tạo bản ghi idempotency key với ràng buộc duy nhất.
2. Đọc giỏ, kiểm tra sản phẩm còn bán và lấy giá hiện tại.
3. Trừ tồn từng biến thể với điều kiện `stockQuantity >= quantity`.
4. Cấp mã đơn và lưu đơn cùng snapshot các dòng hàng.
5. Xóa giỏ và liên kết idempotency key với đơn vừa tạo.

Nếu cập nhật tồn ảnh hưởng 0 dòng, service trả lỗi hết hàng. Lỗi trong transaction
rollback cả các dòng tồn đã trừ trước đó. Các biến thể được cập nhật theo thứ tự
ID tăng dần để giảm nguy cơ deadlock khi nhiều giỏ có các sản phẩm chung.

Cách cập nhật có điều kiện gắn việc kiểm và trừ tồn vào cùng một câu lệnh, tránh
khoảng trống giữa “đọc tồn” và “ghi tồn”. Điều này không có nghĩa toàn bộ checkout
được cấu hình ở isolation level `Serializable`.

Khi khóa bị trùng, service tra đơn đã gắn với khóa và trả lại đơn đó. Cơ chế hiện
tại dùng khóa duy nhất toàn cục; nhánh xử lý trùng chưa đối chiếu user hay nội dung
yêu cầu ban đầu. Bản ghi có `expiresAt`, nhưng nhánh này chưa kiểm hạn và chưa có
job dọn khóa. Vì vậy không coi đây là cơ chế replay đã bao phủ mọi trường hợp.

Mã đơn có dạng `SF-YYMMDD-NNNN`; bộ đếm theo ngày được tăng bằng
`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Mã dễ đọc khi tra cứu nhưng để
lộ thứ tự đơn trong ngày. Luồng hiện tại tạo đơn COD và đặt phí vận chuyển bằng 0.

Nguồn và kiểm thử: [OrdersService](../apps/api/src/modules/orders/orders.service.ts),
[orders integration tests](../apps/api/src/modules/orders/orders.service.int.test.ts).

### Chuyển trạng thái và hoàn tồn

Luồng giao hàng là `PENDING → CONFIRMED → SHIPPING → DELIVERED`.
Khách được hủy đơn của mình ở `PENDING`; quản trị có thể hủy ở `PENDING` hoặc
`CONFIRMED`. `CANCELLED` và `DELIVERED` là trạng thái cuối của luồng hiện tại.

Service cập nhật đơn với điều kiện trạng thái vẫn bằng trạng thái vừa đọc, rồi
kiểm tra số dòng bị ảnh hưởng. Chuyển trạng thái, hoàn tồn khi hủy và ghi lịch sử
nằm trong một transaction, tránh hai yêu cầu hủy cùng hoàn tồn hai lần.
API trả `allowedTransitions` để frontend hiển thị hành động theo quyền của người xem.

Nhập tồn từ quản trị dùng lượng tăng/giảm, không ghi đè một số tồn tuyệt đối đã đọc
trước đó. Thay đổi giá và điều chỉnh tồn được ghi vào `variant_changes`.

Nguồn: [quy tắc trạng thái](../apps/api/src/modules/orders/domain/order-status.ts),
[OrderAdminService](../apps/api/src/modules/orders/order-admin.service.ts),
[ProductAdminService](../apps/api/src/modules/catalog/product-admin.service.ts).
Kiểm thử: [hủy và chuyển trạng thái](../apps/api/src/modules/orders/order-admin.service.int.test.ts),
[điều chỉnh tồn](../apps/api/src/modules/catalog/product-admin.service.int.test.ts).

## 6. Phạm vi kiểm thử

| Tầng              | Nội dung                                                              | Lệnh từ thư mục gốc                    |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------- |
| Unit và component | Hàm nghiệp vụ, schema, guards, API client và hành vi component Vue    | `pnpm test`                            |
| Integration       | Service với PostgreSQL thật, áp dụng migration SQL qua Testcontainers | `pnpm --filter @shopflow/api test:int` |

Các test đơn hàng có trường hợp 20 lời gọi service đồng thời tranh SKU còn 1,
gửi lại cùng khóa, đổi giá sau khi mua và hủy đồng thời. Đây là kiểm thử service
và database, không phải kiểm thử tải qua HTTP hoặc end-to-end trên trình duyệt.

Integration test dùng một PostgreSQL container cho cả lượt chạy và chạy các file
tuần tự để tránh xung đột dữ liệu. Cấu hình coverage của API đặt ngưỡng 90% trên
nhóm domain/common được chọn, không phải 90% toàn ứng dụng.

[CI](../.github/workflows/ci.yml) cấu hình lint, typecheck, unit/component test,
integration test và build. Danh sách test mô tả phạm vi kiểm tra; kết quả đạt hay
không phải đọc từ lần chạy cụ thể.

Nguồn: [khởi tạo database test](../apps/api/test/global-setup.ts),
[cấu hình integration](../apps/api/vitest.int.config.ts),
[cấu hình coverage API](../apps/api/vitest.config.ts).

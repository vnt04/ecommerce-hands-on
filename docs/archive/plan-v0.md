# ShopFlow — Cửa hàng áo thun trực tuyến

## 1. Mục tiêu

ShopFlow là cửa hàng bán áo thun in sẵn cho thị trường Việt Nam. Hàng được in trước và giữ kho theo size/màu; khách chọn thiết kế, chọn màu và size, đặt hàng; admin quản lý thiết kế, tồn kho theo SKU và xử lý đơn.

Ba tiêu chí quyết định mọi đánh đổi kỹ thuật trong tài liệu này:

1. **Đơn hàng và tiền phải đúng.** Không bán vượt tồn, không tạo trùng đơn, không mất đơn, giá trên đơn không đổi khi bảng giá đổi.
2. **Một người vận hành được.** Deploy tự động, rollback nhanh, log và alarm đủ để biết hỏng ở đâu mà không phải SSH vào máy.
3. **Chi phí tương xứng lưu lượng thật.** Không mua kiến trúc cho traffic chưa tồn tại.

Khi hai lựa chọn kỹ thuật ngang nhau, chọn cái đơn giản hơn để vận hành.

---

## 2. Phạm vi

### 2.1 Trong phạm vi (v1)

Catalog thiết kế áo thun có biến thể theo màu × size, giỏ hàng (kể cả khách chưa đăng nhập), đặt hàng, theo dõi đơn, quản trị thiết kế/tồn kho/đơn hàng, email giao dịch.

### 2.2 Ngoài phạm vi — không làm

| Không làm | Lý do |
|---|---|
| Print-on-demand / in theo đơn | Mô hình là in trước, giữ kho. POD cần tích hợp xưởng in và bỏ hoàn toàn khái niệm tồn kho hữu hạn. |
| Khách tự upload thiết kế | Đó gần như là một sản phẩm khác: upload, preview mockup, kiểm duyệt bản quyền. |
| Marketplace đa nhà bán | Một chủ shop, một kho. |
| Tự lưu/xử lý dữ liệu thẻ | Không bao giờ. Khi có cổng thật, dùng hosted checkout. |
| Đa ngôn ngữ / đa tiền tệ | Chỉ bán VN, VND. |
| Microservices | Một backend duy nhất. Chưa có áp lực nào biện minh cho việc tách. |
| Search engine riêng | Postgres full-text + trigram đủ cho quy mô vài trăm thiết kế. |

### 2.3 Hoãn đến khi có nhu cầu thật

SNS/EventBridge fan-out (hoãn tới khi có consumer thứ hai thật — trước đó SQS là đủ), read replica, Multi-AZ RDS, auto scaling nhiều bậc. Mỗi mục chỉ mở khi có số liệu chứng minh cần.

---

## 3. Quyết định nền tảng

| Quyết định | Chọn | Lý do | Hệ quả phải chấp nhận |
|---|---|---|---|
| Mô hình bán | In sẵn, giữ tồn kho | Kiểm soát chất lượng và thời gian giao. | Rủi ro tồn đọng size lệch → cần báo cáo bán theo size để đặt in đúng tỉ lệ. |
| Thanh toán | Mock payment | v1 chưa có merchant account. `Payment` entity và state machine thiết kế sẵn để cắm cổng thật. | Mock xác nhận đồng bộ. Cổng thật là bất đồng bộ → cần reservation tồn kho có TTL (§5.4). |
| Biến thể | Màu × Size | Mỗi thiết kế nhiều màu áo, mỗi màu đủ size. | Ma trận SKU lớn: 3 màu × 5 size = 15 SKU / thiết kế. Admin phải sinh và quản lý được hàng loạt. |
| Frontend | Vue 3 + Vite (SPA) | Đơn giản nhất, host tĩnh, không cần nuôi Node server cho web. | **SEO và link preview yếu** — xem §11 để biết cách bù, và ADR-007 ghi rõ khi nào cần xem lại. |
| Backend hosting | AWS ECS Fargate + RDS | Rolling deploy và autoscaling hoạt động đúng, không quản OS/patch. | Đắt hơn một VPS. Cần Terraform ngay từ lần deploy đầu. |
| Thị trường | Việt Nam, VND | | VND không có đơn vị nhỏ hơn đồng → lưu integer đồng, cấm số thực. |

---

## 4. Tech stack

**Frontend**
Vue 3 (Composition API, `<script setup>`), Vite, TypeScript, Vue Router, Pinia, TanStack Query (vue-query) cho server state, VeeValidate + Zod cho form, Tailwind CSS.

Nguyên tắc phân tách state: **Pinia chỉ giữ client state** (giỏ hàng cục bộ, phiên đăng nhập, UI). Dữ liệu từ server (sản phẩm, đơn hàng) do TanStack Query quản lý cache và invalidation. Nhồi dữ liệu server vào Pinia rồi tự viết logic refetch là nguồn bug đồng bộ phổ biến nhất trong SPA.

**Backend**
NestJS, TypeScript, Prisma, PostgreSQL 16.

**Hạ tầng**
Docker, Terraform, AWS (S3, CloudFront, ECS Fargate, ALB, RDS, Route 53, ACM, Secrets Manager, CloudWatch, SQS, ElastiCache).

**CI/CD**
GitHub Actions, ECR.

**Chất lượng**
Vitest, Vue Test Utils, Testcontainers, Playwright, ESLint, Prettier.

**Tài liệu**
OpenAPI sinh từ code, ADR trong repo.

---

## 5. Domain model

### 5.1 Entities

```text
User ──< Address
User ──< RefreshToken
User ──< Order ──< OrderItem >──── ProductVariant
  │            ├──< OrderStatusHistory
  │            └──o Payment
  └──o Cart ──< CartItem >──────── ProductVariant

Category ──< Product ──< ProductOption ──< ProductOptionValue
                    │                             │
                    ├──< ProductVariant >─────────┘   (variant = 1 tổ hợp giá trị)
                    │         └──< InventoryMovement
                    ├──< ProductImage  (gắn tuỳ chọn với một màu)
                    └──o SizeChart

AdminAuditLog
```

`Cart` có thể thuộc về `User` hoặc một `cartToken` ẩn danh (§5.7).

### 5.2 Mô hình biến thể màu × size

```text
Product: "Tee Sunset"
├── ProductOption "Màu"  → Đen (#000000), Trắng (#FFFFFF), Navy (#1B2A4A)
├── ProductOption "Size" → S, M, L, XL, 2XL
└── ProductVariant (ma trận, bật/tắt từng tổ hợp)
      TEE-SUNSET-BLK-S   Đen  / S   · 299.000đ · tồn 12
      TEE-SUNSET-BLK-M   Đen  / M   · 299.000đ · tồn 30
      …
      TEE-SUNSET-NVY-2XL Navy / 2XL · 319.000đ · tồn 0   (giá size lớn có thể khác)
```

Quy tắc:

* **Giá và tồn kho nằm ở `ProductVariant`**, không nằm ở `Product`. Size 2XL được phép có giá khác.
* `ProductOptionValue` của màu lưu thêm `hex_code` để render swatch, và `sort_order` để giữ thứ tự size đúng (S → M → L → XL → 2XL, không sắp theo alphabet).
* Admin chọn tập màu và tập size → hệ thống sinh sẵn ma trận variant → admin **tắt** các tổ hợp không sản xuất (ví dụ Navy không có 2XL) và nhập giá/tồn. Bắt admin tạo tay 15 SKU cho mỗi thiết kế là thiết kế sai.
* Quy ước SKU: `{MÃ-THIẾT-KẾ}-{MÀU}-{SIZE}`, ví dụ `TEE-SUNSET-BLK-L`. SKU unique toàn hệ thống, không đổi sau khi đã xuất hiện trong đơn.
* `ProductImage` có `color_option_value_id` tuỳ chọn: đổi swatch màu thì gallery đổi theo. Ảnh không gắn màu là ảnh chung (ảnh chi tiết vải, bảng size).

### 5.3 Quy tắc tiền

* Mọi số tiền lưu `BIGINT`, đơn vị **đồng**. Không `FLOAT`, không `DECIMAL`, không nhân/chia 100.
* `OrderItem` lưu **snapshot** tại thời điểm đặt: `unit_price`, `product_name`, `variant_label` ("Đen / L"), `sku`. Đổi giá hay đổi tên thiết kế sau đó không được làm thay đổi đơn cũ.
* `Order` lưu đủ thành phần: `subtotal`, `shipping_fee`, `discount_amount`, `tax_amount`, `grand_total`.
* `grand_total` phải tính lại được từ các thành phần — có unit test khẳng định bất biến này.
* Giá hiển thị đã gồm VAT (chuẩn bán lẻ VN); `tax_amount` tách riêng để phục vụ hoá đơn.

### 5.4 Quy tắc tồn kho

Tồn kho thuộc về `ProductVariant` — tức là theo từng cặp màu × size, không phải theo thiết kế.

* **Thêm vào giỏ không trừ tồn.** Giỏ hàng không phải cam kết mua.
* **Trừ tồn xảy ra trong cùng transaction tạo đơn**, bằng câu lệnh có điều kiện:

  ```sql
  UPDATE product_variants
     SET stock_quantity = stock_quantity - :qty
   WHERE id = :id AND stock_quantity >= :qty
  ```

  Nếu số dòng bị ảnh hưởng = 0 → hết hàng → rollback toàn bộ đơn, trả `409 OUT_OF_STOCK` kèm danh sách SKU thiếu để frontend chỉ đúng size nào hết.
* **Huỷ đơn hoặc thanh toán thất bại** → cộng trả tồn trong cùng transaction đổi trạng thái.
* Mọi thay đổi tồn ghi một dòng `InventoryMovement` (delta, lý do, `order_id`, người thực hiện). Không sửa `stock_quantity` bằng tay mà không có bản ghi.
* **Nghiệm thu bắt buộc:** 100 request đồng thời mua `TEE-SUNSET-BLK-L` khi tồn còn đúng 10 → đúng 10 đơn thành công, 90 đơn nhận `409`, tồn về 0. Đây là tiêu chí nghiệm thu, không phải bài tập tuỳ chọn.

Với hàng may mặc, size giữa (M, L) hết trước size biên là chuyện thường. Trang sản phẩm phải **hiển thị size hết hàng ở trạng thái vô hiệu hoá, không ẩn đi** — ẩn đi khiến khách tưởng shop không bán size đó.

### 5.5 Order state machine

```text
                  ┌──────────────────┐
                  │ PENDING_PAYMENT  │
                  └────┬────────┬────┘
             thanh toán│        │thất bại / hết hạn
                    ok │        ↓
                       │   ┌──────────────────┐
                       │   │  PAYMENT_FAILED  │ (trả tồn)
                       │   └──────────────────┘
                       ↓
                  ┌─────────┐
                  │  PAID   │
                  └────┬────┘
                       ↓
                 ┌────────────┐
                 │ PROCESSING │   (soạn hàng, đóng gói)
                 └─────┬──────┘
                       ↓
                  ┌─────────┐      ┌───────────┐
                  │ SHIPPED │ ───> │ DELIVERED │
                  └─────────┘      └───────────┘

CANCELLED: đến được từ PENDING_PAYMENT, PAID, PROCESSING (trả tồn)
```

| Từ | Đến | Ai được phép | Tác dụng phụ |
|---|---|---|---|
| PENDING_PAYMENT | PAID | Hệ thống (payment xác nhận) | Xoá giỏ, gửi email xác nhận |
| PENDING_PAYMENT | PAYMENT_FAILED | Hệ thống | Trả tồn |
| PENDING_PAYMENT / PAID / PROCESSING | CANCELLED | Khách (trước SHIPPED) hoặc Admin | Trả tồn, gửi email |
| PAID | PROCESSING | Admin | — |
| PROCESSING | SHIPPED | Admin | Lưu mã vận đơn, gửi email |
| SHIPPED | DELIVERED | Admin | Gửi email |

Mọi chuyển trạng thái đi qua **một** hàm duy nhất; transition không có trong bảng bị từ chối. Mỗi lần chuyển ghi một dòng `OrderStatusHistory` (from, to, actor, lý do, thời điểm).

`REFUNDED` chỉ thêm khi có cổng thanh toán thật.

### 5.6 Chống trùng đơn

`POST /orders` yêu cầu header `Idempotency-Key` do client sinh, lưu kèm đơn với unique index. Request lặp lại cùng khoá trả về đúng đơn cũ thay vì tạo đơn mới. Thiếu cái này thì double-click hoặc retry tạo hai đơn và trừ tồn hai lần.

### 5.7 Giỏ hàng khách vãng lai

Giỏ gắn với `cartToken` trong httpOnly cookie khi chưa đăng nhập. Lúc đăng nhập, gộp giỏ ẩn danh vào giỏ user (cộng số lượng, chặn trần theo tồn hiện có), rồi xoá giỏ ẩn danh. Bắt đăng nhập trước khi xem giỏ là cách nhanh nhất để mất khách.

### 5.8 Vòng đời sản phẩm

Không xoá cứng `Product`/`ProductVariant` đã xuất hiện trong đơn — sẽ hỏng lịch sử. Dùng `archived_at`: API công khai ẩn hàng archived, đơn cũ vẫn đọc được. `Product` có `status` (`DRAFT` / `PUBLISHED`) và `slug` unique.

---

## 6. Đặc thù hàng may mặc

Phần này là những thứ một shop áo thun bắt buộc phải có mà một plan ecommerce chung chung sẽ bỏ sót.

**Bảng size**
Mỗi thiết kế liên kết tới một `SizeChart` (dùng chung theo kiểu dáng). Bảng ghi số đo thật: rộng ngực, dài áo, dài tay theo từng size, kèm gợi ý theo chiều cao/cân nặng. Size VN chạy nhỏ hơn size quốc tế — không ghi rõ số đo là mời gọi đổi trả.

**Thông tin sản phẩm**
Chất liệu (ví dụ cotton 100%, 250gsm), kiểu dáng, kiểu cổ, hướng dẫn giặt là, ghi chú về công nghệ in (DTG/lụa) và cách bảo quản hình in. Đây là các trường có cấu trúc trên `Product`, không nhét hết vào một ô mô tả tự do.

**Ảnh**
Mỗi màu tối thiểu: mặt trước, mặt sau, ảnh chi tiết hình in, ảnh mặc trên người. Nhóm theo màu để swatch đổi được gallery.

**Bộ lọc trên trang danh sách**
Màu, size, khoảng giá, danh mục thiết kế, còn hàng. Lọc theo size phải lọc ở mức variant — "còn size L" nghĩa là tồn tại variant size L còn hàng, không phải thiết kế đó có size L trên lý thuyết.

**Đổi size**
Đổi size là lý do đổi trả phổ biến nhất của hàng may mặc. v1: công bố chính sách đổi trả rõ ràng, admin xử lý thủ công bằng cách huỷ đơn cũ (trả tồn) và tạo đơn mới, có ghi lý do vào `AdminAuditLog`. Luồng tự phục vụ (`ExchangeRequest`) nằm ở Phase 6 — đây là thứ đầu tiên nên tự động hoá khi lượng đơn tăng.

**Vận chuyển**
Áo thun nhẹ (~200–250g/chiếc), phí ship tính theo bậc khối lượng và nội thành/liên tỉnh. Lưu `weight_grams` trên variant để tính đúng khi đơn nhiều món.

**Báo cáo cho việc đặt in**
Doanh số theo SKU và theo size để biết tỉ lệ size cần in lần sau. In đều tay mỗi size là cách chắc chắn nhất để tồn đọng size biên.

---

## 7. Chức năng

### 7.1 Khách hàng

**Tài khoản** — Đăng ký, đăng nhập, đăng xuất, hồ sơ, sổ địa chỉ, đặt lại mật khẩu qua email, xác minh email (không chặn đặt hàng).

**Catalog** — Trang chủ, danh sách theo danh mục, tìm kiếm, lọc, sắp xếp, phân trang. Trang chi tiết: swatch chọn màu (đổi gallery), chọn size (size hết hiển thị vô hiệu hoá), bảng size, thông tin chất liệu, cảnh báo "chỉ còn N chiếc" khi tồn thấp.

**Giỏ hàng** — Xem, sửa số lượng, xoá, tạm tính, cảnh báo khi variant hết hàng hoặc đổi giá kể từ lúc thêm vào giỏ.

**Đặt hàng** — Chọn địa chỉ, chọn phương thức vận chuyển và phí, xem tổng cuối, xác nhận, nhận email.

**Đơn hàng** — Danh sách, chi tiết, trạng thái và lịch sử, huỷ đơn khi chưa giao.

### 7.2 Admin

**Thiết kế / sản phẩm** — Tạo/sửa/lưu trữ, khai báo tập màu và tập size, sinh ma trận variant, bật/tắt tổ hợp, nhập giá và tồn hàng loạt, upload và nhóm ảnh theo màu, gán bảng size, đăng/gỡ đăng, quản lý danh mục.

**Tồn kho** — Xem tồn theo SKU dạng lưới màu × size, điều chỉnh tồn kèm lý do bắt buộc, lịch sử `InventoryMovement`, danh sách SKU sắp hết.

**Đơn hàng** — Lọc theo trạng thái/ngày/khách, chi tiết, chuyển trạng thái, nhập mã vận đơn, huỷ kèm lý do.

**Báo cáo** — Doanh thu theo ngày, bán chạy theo thiết kế, phân bổ bán theo size.

**Quản trị** — Tài khoản admin không tự đăng ký được, tạo bằng seed hoặc CLI. Mọi hành động admin làm đổi dữ liệu ghi `AdminAuditLog`.

---

## 8. Quy ước kỹ thuật

### 8.1 Định dạng response

```jsonc
// thành công
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 137 } }

// lỗi
{ "success": false, "error": { "code": "OUT_OF_STOCK", "message": "…", "details": [] } }
```

`code` là hằng số máy đọc được; `message` là câu tiếng Việt hiển thị được. Frontend không bao giờ parse `message` để ra quyết định.

### 8.2 Lỗi và validation

* Validate ở biên: DTO + schema validation cho mọi input từ ngoài, kể cả biến môi trường lúc khởi động.
* Exception filter toàn cục ánh xạ domain error → HTTP status. Không lộ stack trace hay chi tiết SQL ra client.
* Không nuốt lỗi. Mọi `catch` phải hoặc xử lý được, hoặc log kèm ngữ cảnh rồi ném tiếp.
* Zod schema dùng chung giữa web và api qua `packages/shared` — validate hai nơi bằng một định nghĩa.

### 8.3 Auth trong kiến trúc SPA

Vì SPA và API nằm sau **cùng một CloudFront distribution** (§18), mọi request là same-origin — không có CORS, cookie hoạt động đơn giản.

* Refresh token nằm trong cookie `httpOnly` `Secure` `SameSite=Lax`. Access token sống ngắn (15 phút) **giữ trong bộ nhớ** của app.
* **Không lưu token trong `localStorage`.** Bất kỳ script XSS nào cũng đọc được `localStorage`; cookie `httpOnly` thì không.
* Access token hết hạn → interceptor tự gọi `/auth/refresh` một lần rồi phát lại request. Nhiều request 401 đồng thời phải gộp về **một** lần refresh, không được bắn song song.
* Refresh token xoay vòng; phát hiện dùng lại token cũ → thu hồi cả họ token của phiên đó.
* Rate limit `login` / `register` / `forgot-password` theo IP và theo email.
* Mật khẩu băm bằng argon2id (hoặc bcrypt cost ≥ 12).
* RBAC hai vai: `CUSTOMER`, `ADMIN`. Guard mặc định là chặn; endpoint công khai khai báo tường minh.
* Frontend guard chỉ để làm UX. **Mọi quyền được kiểm tra lại ở backend** — SPA là code chạy trên máy người khác, không tin được.

### 8.4 Phân trang

Cursor-based cho danh sách dài. `OFFSET` lớn làm Postgres chậm dần theo số trang. Mọi endpoint trả list có giới hạn cứng `limit` (mặc định 20, tối đa 100).

### 8.5 Code

Theo `~/.claude/rules/ecc/common/coding-style.md`: dữ liệu bất biến, file nhỏ và tập trung theo domain, hàm < 50 dòng, không magic number, comment chỉ giải thích *tại sao*.

---

## 9. Testing

| Loại | Phạm vi | Công cụ |
|---|---|---|
| Unit (api) | Logic domain: tính giá, state machine, quy tắc tồn kho, gộp giỏ, sinh ma trận variant | Vitest |
| Unit (web) | Composable, store, component có logic | Vitest + Vue Test Utils |
| Integration | API thật trên Postgres thật | Testcontainers |
| E2E | 3 luồng sống còn (dưới) | Playwright |

**Ba luồng E2E bắt buộc xanh trước mọi lần deploy:**

1. Khách vãng lai duyệt → chọn màu Đen size L → thêm giỏ → đăng nhập (giỏ được gộp) → đặt hàng → thấy đơn trong lịch sử.
2. Admin tạo thiết kế 3 màu × 5 size → tắt 2 tổ hợp → đăng → trang khách hiện đúng swatch và đúng các size còn bán.
3. Admin chuyển đơn PAID → PROCESSING → SHIPPED → DELIVERED, khách thấy đúng trạng thái.

Độ phủ tối thiểu 80%, ưu tiên tuyệt đối cho tầng domain/service. Test song song phải cô lập dữ liệu.

---

## 10. Phase 0 — Nền móng

Mọi thứ dưới đây có trước khi viết dòng logic nghiệp vụ đầu tiên.

* [ ] Monorepo (`apps/web`, `apps/api`, `packages/shared`)
* [ ] TypeScript strict, ESLint, Prettier, pre-commit hook
* [ ] Docker Compose: Postgres, api, web
* [ ] Prisma + migration đầu + seed script
* [ ] Validate biến môi trường lúc khởi động, fail-fast nếu thiếu
* [ ] Structured logging (JSON, có request-id)
* [ ] `/healthz` và `/readyz`
* [ ] Exception filter và response envelope
* [ ] Vite dev proxy `/api` → backend, để dev và prod cùng là same-origin
* [ ] GitHub Actions CI: lint → typecheck → test → build, chặn merge nếu đỏ
* [ ] `docs/decisions/` + ADR-001

CI có mặt từ Phase 0, không phải sau khi đã có 5000 dòng chưa từng được kiểm tra tự động.

---

## 11. Phase 1 — Core commerce (chạy local)

Mục tiêu: một cửa hàng hoàn chỉnh chạy được bằng `docker compose up`.

**Backend**

* [ ] User, RefreshToken, Address + đăng ký/đăng nhập/refresh/logout
* [ ] Đặt lại mật khẩu, xác minh email
* [ ] Rate limit các endpoint auth
* [ ] Guard xác thực + guard vai trò
* [ ] Category, Product, ProductOption, ProductOptionValue, ProductVariant, ProductImage, SizeChart
* [ ] API sinh ma trận variant từ tập màu × tập size
* [ ] Cập nhật giá/tồn hàng loạt theo lưới
* [ ] Lưu trữ (archive) thay cho xoá cứng
* [ ] API danh sách: phân trang, lọc (màu/size/giá/còn hàng), sắp xếp, tìm kiếm
* [ ] Cart, CartItem + giỏ ẩn danh và gộp giỏ khi đăng nhập
* [ ] Tính phí vận chuyển theo bậc khối lượng và VAT
* [ ] Tạo đơn: transaction + trừ tồn có điều kiện + idempotency key
* [ ] Mock payment và chuyển trạng thái PAID / PAYMENT_FAILED
* [ ] Order state machine + OrderStatusHistory
* [ ] Huỷ đơn và trả tồn
* [ ] InventoryMovement cho mọi thay đổi tồn
* [ ] Upload ảnh qua một interface lưu trữ (implement local disk trước, S3 sau — không rải `fs.writeFile` khắp code)
* [ ] Email giao dịch qua một interface mailer (implement log-to-console trước)
* [ ] AdminAuditLog
* [ ] Báo cáo doanh thu và phân bổ bán theo size
* [ ] OpenAPI sinh từ code

**Frontend — khách**

* [ ] Layout, router, Pinia store, API client có interceptor refresh token
* [ ] Trang chủ, danh sách, bộ lọc màu/size/giá
* [ ] Trang chi tiết: swatch màu đổi gallery, chọn size, size hết vô hiệu hoá, bảng size, thông tin chất liệu
* [ ] Giỏ hàng
* [ ] Đăng ký / đăng nhập / quên mật khẩu
* [ ] Đặt hàng: địa chỉ, vận chuyển, xác nhận
* [ ] Lịch sử đơn và chi tiết đơn
* [ ] Trạng thái loading (skeleton), lỗi, rỗng cho mọi trang dữ liệu
* [ ] Code splitting theo route; tách hẳn bundle admin khỏi bundle khách
* [ ] Responsive, ưu tiên mobile
* [ ] Ảnh responsive: WebP/AVIF, `srcset`, lazy-load ảnh ngoài viewport

**Frontend — admin**

* [ ] Đăng nhập admin
* [ ] Dashboard: doanh thu hôm nay, đơn chờ xử lý, SKU sắp hết
* [ ] Quản lý thiết kế và ma trận variant (lưới màu × size)
* [ ] Quản lý ảnh theo màu
* [ ] Quản lý tồn kho có ghi lý do
* [ ] Quản lý đơn và chuyển trạng thái

**SEO trong giới hạn của SPA**

SPA không server-render, nên hai thứ sau không tự có — phải làm tường minh:

* [ ] Meta title/description/canonical động bằng `@unhead/vue`
* [ ] JSON-LD `Product` + `Offer` (giá, tình trạng còn hàng) chèn theo route
* [ ] `sitemap.xml` sinh từ dữ liệu sản phẩm, `robots.txt`
* [ ] **Edge function trả HTML tối giản có OG tag cho crawler mạng xã hội.** Facebook và Zalo không chạy JavaScript — không có bước này thì mọi link sản phẩm chia sẻ đều không có ảnh và tiêu đề preview. Với shop áo thun sống nhờ chia sẻ mạng xã hội, đây là hạng mục doanh thu chứ không phải hạng mục kỹ thuật.
* [ ] Đo bằng Google Search Console sau khi lên production: trang sản phẩm có được index không, sau bao lâu

Ghi kết quả đo vào ADR-007. Nếu index chậm hoặc thiếu, phương án tiếp theo là prerender trang sản phẩm lúc build (`vite-ssg`) — không cần viết lại sang framework khác.

**Chất lượng**

* [ ] Unit test domain
* [ ] Integration test các endpoint chính
* [ ] 3 luồng E2E
* [ ] Load test tồn kho đồng thời (§5.4)
* [ ] Seed dữ liệu mẫu đủ thật để dùng thử (vài thiết kế, đủ màu và size)

---

## 12. Phase 2 — Lên production

Mục tiêu: chạy thật trên tên miền thật, HTTPS, có backup, deploy tự động. Đây là **một** phase — không deploy trước rồi vá bảo mật sau.

**Terraform (mọi thứ, không click console)**

* [ ] Module network: VPC, 2 AZ, public/private subnet, IGW, NAT, route table, security group
* [ ] Module data: RDS PostgreSQL trong private subnet, không public accessible, mã hoá at-rest, PITR bật
* [ ] Module app: ECR, ECS cluster, task definition, service cho `api`
* [ ] Module edge: một CloudFront distribution với 3 origin (SPA trên S3, ALB cho `/api/*`, S3 ảnh), ACM certificate, Route 53
* [ ] SPA fallback: CloudFront map 403/404 → `/index.html` trả 200, để deep link hoạt động
* [ ] Cache policy: `index.html` không cache, asset có hash cache 1 năm
* [ ] Module storage: bucket ảnh (Block Public Access bật, phục vụ qua OAC)
* [ ] Remote state có locking

**Bảo mật ngay từ lần deploy đầu**

* [ ] Toàn bộ secret trong Secrets Manager / SSM, inject vào task lúc chạy
* [ ] Không secret nào trong repo, image, hay Terraform state đọc được
* [ ] **Không nhét secret vào biến `VITE_*`** — mọi biến build của Vite nằm trong bundle tải về máy khách
* [ ] Task role IAM tối thiểu quyền, không dùng access key tĩnh
* [ ] HTTPS bắt buộc, HTTP redirect 301
* [ ] Security header qua CloudFront response headers policy (HSTS, CSP, X-Content-Type-Options)
* [ ] RDS không có đường vào từ internet — truy cập qua SSM Session Manager khi cần

**CD**

* [ ] Push `main` → build image API tag theo git SHA → push ECR
* [ ] Chạy migration bằng một ECS task riêng **trước** khi cập nhật service
* [ ] Rolling update với health check và deployment circuit breaker (tự rollback khi task mới không healthy)
* [ ] Build SPA → sync S3 → invalidate CloudFront cho `index.html`
* [ ] Smoke test sau deploy
* [ ] Rollback thủ công: deploy lại task definition trước đó + sync lại bản SPA trước, < 5 phút

**Quy tắc migration:** expand/contract. Migration phải tương thích ngược với code đang chạy. Không drop cột trong cùng release với code ngừng dùng cột đó — tách hai release.

**Chuyển sang hạ tầng thật**

* [ ] Storage interface đổi sang S3 (upload trực tiếp bằng presigned URL)
* [ ] Mailer interface đổi sang SES
* [ ] Ảnh phục vụ qua CloudFront

---

## 13. Phase 3 — Vận hành được

Mục tiêu: khi hệ thống hỏng lúc 2 giờ sáng, biết được nó hỏng và hỏng ở đâu.

* [ ] Log tập trung ở CloudWatch Logs, request-id xuyên suốt, **không log PII/token/mật khẩu**
* [ ] Error tracking (Sentry hoặc tương đương) cho **cả frontend và backend**, có source map — lỗi SPA xảy ra trên máy khách, không có gì trong log server
* [ ] Dashboard: request rate, tỉ lệ lỗi, p95 latency, số đơn/giờ, CPU/connection của RDS
* [ ] Alarm tới người thật: tỉ lệ 5xx, p95 latency, ECS task restart lặp, RDS CPU/connections/storage, ALB unhealthy host, không có đơn nào trong N giờ
* [ ] **Thử alarm bằng cách gây lỗi giả** — alarm chưa từng kêu là alarm chưa tồn tại
* [ ] WAF: rate limit, managed rule cơ bản
* [ ] Runbook cho 5 sự cố hay gặp nhất
* [ ] AWS Budget alarm

---

## 14. Phase 4 — Xử lý bất đồng bộ

Chỉ mở khi có việc thật không cần nằm trong HTTP request: gửi email, tạo thumbnail ảnh sản phẩm, cảnh báo SKU sắp hết.

* [ ] SQS queue + DLQ
* [ ] **Outbox pattern**: ghi event vào bảng `outbox` trong cùng transaction nghiệp vụ, publisher đọc và đẩy lên SQS. Publish trực tiếp trong transaction → commit DB xong mà publish lỗi là mất event vĩnh viễn.
* [ ] Worker chạy như ECS service riêng
* [ ] Consumer **idempotent** — SQS standard giao ít nhất một lần, message sẽ đến hai lần
* [ ] Visibility timeout theo thời gian xử lý thực đo được
* [ ] Alarm độ sâu DLQ và tuổi message cũ nhất
* [ ] Quy trình xử lý message trong DLQ

---

## 15. Phase 5 — Hiệu năng

Quy tắc: **đo trước, sửa sau.** Mỗi mục chỉ làm khi profiling chỉ ra nó.

* [ ] Bật `pg_stat_statements`, tìm query chậm thật
* [ ] Index theo query thật: `products(slug)`, `products(category_id, status)`, `product_variants(product_id)`, `product_variants(sku)` unique, `orders(user_id, created_at DESC)`, `order_items(order_id)`, GIN cho full-text
* [ ] Diệt N+1 ở danh sách sản phẩm (mỗi thiết kế kéo theo hàng chục variant — đây là chỗ N+1 chắc chắn xuất hiện)
* [ ] API danh sách chỉ trả dữ liệu tổng hợp cần cho card (giá thấp nhất, danh sách màu, có còn hàng không), không trả toàn bộ ma trận variant
* [ ] ElastiCache Redis, cache-aside cho chi tiết và danh sách sản phẩm
* [ ] Invalidate cache khi admin sửa sản phẩm hoặc khi tồn về 0 — cache sai còn tệ hơn không cache
* [ ] Ngân sách bundle frontend: initial JS < 200KB gzip; theo dõi trong CI, vượt là fail
* [ ] Ngân sách hiệu năng: LCP < 2.5s trên 4G
* [ ] Load test bằng k6, ghi kết quả trước/sau

Mọi tối ưu ghi lại theo: **vấn đề → số đo → giải pháp → số đo sau**. Không tối ưu theo cảm giác.

---

## 16. Phase 6 — Tính năng tăng trưởng

Xếp theo giá trị kinh doanh, làm khi cần chứ không làm cho đủ bộ.

* [ ] Cổng thanh toán thật (VNPay/MoMo hoặc Stripe) — kèm ADR về reservation tồn kho có TTL, xác thực chữ ký webhook, và đối soát
* [ ] Luồng đổi size tự phục vụ (`ExchangeRequest`) — ưu tiên cao với hàng may mặc
* [ ] Thông báo khi có hàng lại theo SKU
* [ ] Mã giảm giá (theo % / số tiền, giới hạn lượt, hạn dùng, đơn tối thiểu)
* [ ] Đánh giá sản phẩm có kiểm duyệt, kèm ghi chú "size có đúng không"
* [ ] Danh sách yêu thích
* [ ] Tích hợp GHN/GHTK: tạo vận đơn, đồng bộ trạng thái
* [ ] Xuất hoá đơn
* [ ] Analytics giỏ hàng bị bỏ

---

## 17. Phase 7 — Mở rộng khi số liệu yêu cầu

Không làm trước. Mỗi mục cần một số đo cụ thể mở khoá nó.

| Việc | Chỉ làm khi |
|---|---|
| RDS Multi-AZ | Downtime DB không còn chấp nhận được (lưu ý: chi phí DB tăng gấp đôi) |
| Read replica | Query đọc thực sự làm nghẽn primary |
| ECS auto scaling nhiều bậc | Traffic có đỉnh rõ rệt và đã đo được |
| Prerender / SSR cho web | Search Console cho thấy trang sản phẩm không được index tốt |

---

## 18. Kiến trúc production

```text
                        Internet
                            │
                        Route 53
                            │
                    CloudFront + WAF
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
      /api/*             /images/*             /*
        │                   │                   │
       ALB              S3 (OAC)            S3 (OAC)
        │              ảnh sản phẩm         SPA build
        │                                   403/404 → index.html
   ECS api ────── ECS worker
   private subnet, 2 AZ
        │              │
   ┌────┴────┬─────────┴────┐
   │         │              │
 RDS     ElastiCache    SQS + DLQ
(private)  (private)
```

Một CloudFront distribution phục vụ cả SPA lẫn API dưới cùng một tên miền. Hệ quả: **không có CORS, cookie auth hoạt động đơn giản, và không phải nuôi một ECS service cho web.**

RDS và Redis nằm trong private subnet, security group chỉ nhận traffic từ security group của ECS task. Không có đường nào từ internet vào thẳng cơ sở dữ liệu.

---

## 19. Bảo mật

**Bắt buộc trước khi mở cho người dùng thật**

* [ ] Không secret nào trong git (quét cả lịch sử, không chỉ HEAD)
* [ ] Không secret nào trong bundle frontend (`VITE_*` là công khai)
* [ ] Mọi input được validate ở biên
* [ ] Truy vấn tham số hoá (Prisma lo, raw query phải tự kiểm)
* [ ] Chống XSS: không `v-html` với nội dung người dùng nhập
* [ ] CSP đủ chặt để `v-html` sót cũng không chạy được script ngoài
* [ ] Cookie `SameSite=Lax`, `Secure`, `httpOnly`
* [ ] Rate limit endpoint auth và endpoint tạo đơn
* [ ] Login sai không tiết lộ email có tồn tại hay không
* [ ] Kiểm tra quyền sở hữu ở mọi endpoint theo id (IDOR: user A không đọc được đơn của user B)
* [ ] Upload ảnh: giới hạn kích thước, whitelist content-type, kiểm magic bytes, đổi tên file
* [ ] Dependabot + `npm audit` trong CI

**Dữ liệu cá nhân**

Chỉ thu thập những gì cần để giao hàng. Đặt thời hạn lưu trữ cho dữ liệu đơn hàng. Có quy trình xoá tài khoản theo yêu cầu. Không bao giờ chạm vào dữ liệu thẻ.

**Nghĩa vụ pháp lý cần kiểm tra trước khi mở bán**

Website thương mại điện tử bán hàng tại Việt Nam có nghĩa vụ thông báo/đăng ký với Bộ Công Thương, và phải công bố trên site: thông tin chủ sở hữu, chính sách bảo mật, chính sách đổi trả, chính sách vận chuyển, phương thức thanh toán. Cần xác minh yêu cầu hiện hành trước khi mở bán — đây là hạng mục pháp lý, không phải kỹ thuật.

**Sở hữu trí tuệ**

Bán áo in hình có rủi ro bản quyền/nhãn hiệu. Cần quy trình duyệt thiết kế trước khi đăng bán và một địa chỉ tiếp nhận khiếu nại gỡ bỏ. Đây là rủi ro vận hành thật của mảng áo in, không phải thủ tục hình thức.

---

## 20. Sao lưu và khôi phục

* Mục tiêu: **RPO ≤ 5 phút** (PITR của RDS), **RTO ≤ 1 giờ**.
* Automated backup 7–14 ngày; snapshot thủ công trước mỗi migration lớn.
* S3 bật versioning cho bucket ảnh.
* **Diễn tập khôi phục ít nhất một lần**, ghi lại thời gian thực tế. Bản backup chưa từng restore không phải backup.
* Runbook: khôi phục DB về một mốc thời gian; xử lý khi một AZ mất; xử lý khi worker chết giữa chừng.

---

## 21. Chi phí

Ước tính rất thô cho `ap-southeast-1`, cấu hình nhỏ, single-AZ. **Cần kiểm chứng bằng AWS Pricing Calculator trước khi cam kết** — giá thay đổi theo thời gian và theo region.

| Hạng mục | Ước tính / tháng |
|---|---|
| ALB | ~$20 |
| ECS Fargate (api + worker, task nhỏ) | ~$20–30 |
| RDS db.t4g.micro + storage | ~$20 |
| NAT Gateway | ~$35 + phí data |
| S3 + CloudFront (SPA + ảnh, lưu lượng thấp) | ~$5 |
| Secrets Manager, CloudWatch | ~$5 |
| **Tổng** | **~$105–115** |

Hai điểm đáng chú ý:

* **NAT Gateway thường là khoản đắt bất ngờ.** Dùng VPC Endpoint cho ECR, S3, CloudWatch Logs và Secrets Manager để cắt phần lớn lưu lượng qua NAT.
* Multi-AZ RDS làm chi phí DB tăng gấp đôi. Chỉ bật khi downtime thực sự đắt hơn khoản đó.

Chọn SPA thay vì SSR tiết kiệm được một ECS service (~$15/tháng) và bớt một thứ phải vận hành. Đó là mặt được của đánh đổi ở ADR-007.

Đặt AWS Budget alarm ngay ở Phase 2, không đợi nhận hoá đơn.

---

## 22. Cấu trúc repository

```text
shopflow/
├── apps/
│   ├── web/                 # Vue 3 + Vite
│   │   ├── src/
│   │   │   ├── features/    # catalog, cart, checkout, orders, admin
│   │   │   ├── shared/      # ui, composables, api client
│   │   │   └── router/
│   └── api/                 # NestJS (gồm cả worker)
│       └── src/modules/     # auth, catalog, inventory, cart, orders, admin
├── packages/
│   └── shared/              # type dùng chung, zod schema
├── infra/
│   ├── terraform/
│   │   ├── modules/         # network, data, app, edge, storage
│   │   └── envs/            # dev, prod
│   └── docker/
├── docs/
│   ├── architecture/
│   ├── decisions/           # ADR
│   ├── runbooks/
│   └── api/
├── .github/workflows/
├── docker-compose.yml
├── README.md
└── plan.md
```

Tổ chức theo feature/domain, không theo loại file. Thư mục `components/` chứa 80 component không liên quan nhau là dấu hiệu của tổ chức sai.

---

## 23. Architecture Decision Records

Ghi ADR khi một quyết định khó đảo ngược, hoặc khi sáu tháng sau sẽ có người hỏi "sao lại làm thế này?".

Cần viết ngay:

```text
ADR-001-postgresql-la-datastore-chinh.md
ADR-002-variant-theo-mau-va-size.md
ADR-003-tru-ton-kho-trong-transaction-tao-don.md
ADR-004-ecs-fargate-thay-vi-ec2.md
ADR-005-mock-payment-va-duong-di-len-cong-that.md
ADR-006-luu-tien-bang-integer-dong.md
ADR-007-spa-thay-vi-ssr-va-cach-bu-seo.md
ADR-008-mot-cloudfront-cho-ca-spa-va-api.md
```

Mỗi ADR: Bối cảnh → Các phương án → Quyết định → Lý do → Đánh đổi phải chấp nhận → **Điều gì sẽ khiến ta xem lại quyết định này**.

Mục cuối quan trọng nhất và hay bị bỏ qua nhất. Với ADR-007, điều kiện xem lại đã rõ: số liệu index từ Search Console sau 4–8 tuần chạy thật.

---

## 24. Tiêu chí thành công

Đo được hoặc không tính.

**Nghiệp vụ**

* [ ] Đặt được đơn thật end-to-end trên production
* [ ] Admin tạo được thiết kế 3 màu × 5 size và bán được
* [ ] Admin xử lý được đơn từ PAID đến DELIVERED
* [ ] Tồn kho sau 100 đơn khớp chính xác với sổ `InventoryMovement`

**Tính đúng đắn**

* [ ] 0 ca oversell trong load test 100 request đồng thời trên cùng một SKU
* [ ] 0 đơn trùng khi client retry cùng `Idempotency-Key`
* [ ] Đổi giá sản phẩm không làm thay đổi tổng tiền của đơn đã đặt

**Hiệu năng**

* [ ] p95 API danh sách/chi tiết sản phẩm < 300ms
* [ ] LCP trang sản phẩm < 2.5s trên 4G
* [ ] Initial JS bundle < 200KB gzip

**SEO / phân phối**

* [ ] Link sản phẩm chia sẻ lên Facebook và Zalo hiện đúng ảnh và tiêu đề
* [ ] Trang sản phẩm được Google index (kiểm bằng Search Console sau 4–8 tuần)

**Vận hành**

* [ ] Deploy tự động < 10 phút, không downtime
* [ ] Rollback < 5 phút, đã thử ít nhất một lần
* [ ] Alarm đã kêu ít nhất một lần trong diễn tập
* [ ] Đã diễn tập khôi phục DB, có ghi lại thời gian thực tế

**Bảo mật**

* [ ] Không secret nào trong repo hay trong bundle frontend
* [ ] DB không truy cập được từ internet
* [ ] Toàn bộ traffic qua HTTPS
* [ ] Không có lỗ hổng IDOR trên các endpoint theo id

---

## 25. Nguyên tắc

**Mỗi thành phần hạ tầng phải giải quyết một vấn đề đã quan sát được.**

Sai:

```text
"Thêm Redis vì hệ thống nào cũng có Redis."
```

Đúng:

```text
"Trang chi tiết sản phẩm chiếm 60% request, mỗi lần đều
 query DB kèm toàn bộ ma trận variant, p95 400ms.
 → cache-aside
 → Redis
 → invalidate khi admin sửa sản phẩm hoặc khi tồn về 0"
```

Điều này áp dụng cả cho việc *gỡ bỏ*: nếu một thành phần không còn giải quyết vấn đề nào, gỡ nó đi.

Câu hỏi kiểm tra trước mỗi lần thêm thứ gì vào kiến trúc:

> Vấn đề này đã xảy ra chưa, hay tôi đang đoán là nó sẽ xảy ra?

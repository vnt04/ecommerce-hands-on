# Code Style

Nền chung: `~/.claude/rules/ecc/common/coding-style.md`. File này ghi phần riêng của ShopFlow và những chỗ ghi đè.

Định dạng do Prettier + ESLint quyết định. Không tranh luận dấu phẩy, không format bằng tay.

> Mục nào đánh dấu **⏳ chốt ở S0X** là quy ước chưa quyết. Gặp tình huống cần nó mà bước hiện tại chưa chốt → hỏi, không tự chọn.

---

## 1. Ngưỡng cứng

| Ngưỡng | Giá trị |
|---|---|
| Dòng / hàm | ≤ 50 |
| Dòng / file | ≤ 400 thông thường, 800 tuyệt đối |
| Độ sâu lồng | ≤ 4 — dùng early return |
| Tham số / hàm | ≤ 4 — nhiều hơn thì gom thành object |

Vượt ngưỡng không phải lỗi tự động, nhưng phải giải thích được trong PR.

---

## 2. TypeScript

- `strict: true` ở mọi package. Không tắt cục bộ.
- **Cấm `any`.** Không biết kiểu thì `unknown` rồi thu hẹp bằng schema validation.
- Cấm `@ts-ignore`. `@ts-expect-error` được phép nhưng **bắt buộc kèm comment lý do**.
- Cấm `!` (non-null assertion) trừ khi ngay trên nó có comment giải thích vì sao chắc chắn non-null.
- `type` cho shape dữ liệu, `interface` cho hợp đồng được implement.
- Không export default, trừ chỗ framework bắt buộc (Vue SFC, Vite config).
- Immutable: `readonly` cho field không đổi, không mutate tham số, spread thay vì `push`/`splice` trên dữ liệu dùng chung.

### 2.1 Tiền — ràng buộc P1

Mọi số tiền là **số nguyên, đơn vị đồng**.

- Cấm `float`, cấm `parseFloat`, cấm `toFixed`, cấm `* 100` / `/ 100` trên dữ liệu tiền.
- Format hiển thị chỉ xảy ra ở tầng UI, qua đúng **một** hàm `formatVnd()`.
- Tổng tiền đơn hàng luôn tính lại được từ các thành phần — có unit test giữ bất biến này.

**⏳ Chốt ở S02**: kiểu dữ liệu cụ thể ở DB / TS / JSON. Lưu ý sẵn: `JSON.stringify` **ném lỗi** với `bigint`, nên wire format phải được quyết cùng lúc với kiểu cột, không quyết sau.

### 2.2 Kiểu dùng chung

Type và schema dùng ở cả web và api **phải** nằm trong `packages/shared`. Định nghĩa hai lần rồi tự đồng bộ bằng tay là nguồn bug.

### 2.3 Error code

Mọi `code` trong response lỗi khai báo tập trung tại **một** file trong `packages/shared`. Cấm khai báo chuỗi code rời rạc trong service — trùng code hoặc lệch chính tả sẽ không ai phát hiện được cho tới khi frontend xử lý sai.

---

## 3. Đặt tên

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Biến, hàm | `camelCase` | `reserveStock` |
| Boolean | `is` / `has` / `should` / `can` | `isOutOfStock` |
| Type, class, component | `PascalCase` | `ProductVariant`, `ProductCard.vue` |
| Hằng | `UPPER_SNAKE_CASE` | `MAX_CART_QUANTITY` |
| Composable Vue | `use` + `PascalCase` | `useCart.ts` |
| File TS | `kebab-case.ts` | `order-state-machine.ts` |
| DB table / column | `snake_case`, table số nhiều | `product_variants.stock_quantity` |
| API path | `kebab-case`, số nhiều | `/product-variants` |
| API field JSON | `camelCase` | `stockQuantity` |
| Error code | `UPPER_SNAKE_CASE` | `OUT_OF_STOCK` |
| Biến môi trường | `UPPER_SNAKE_CASE` | `DATABASE_URL` |

Cấm viết tắt tự chế (`prd`, `ordSvc`). Tên dài mà đọc hiểu tốt hơn tên ngắn phải đoán.

**⏳ Chốt ở S02**: có prefix version cho API (`/api/v1/...`) hay không.

---

## 4. Cấu trúc thư mục

Tổ chức **theo feature/domain, không theo loại file**.

```
apps/api/src/modules/orders/
├── orders.module.ts
├── orders.controller.ts        # HTTP: validate + gọi service. Không có logic nghiệp vụ
├── orders.service.ts           # điều phối, transaction
├── domain/
│   ├── order-state-machine.ts  # thuần, không import ORM
│   └── order-total.ts
├── dto/
└── orders.service.spec.ts
```

```
apps/web/src/features/catalog/
├── components/
├── composables/
├── api/
├── pages/
└── index.ts        # public surface của feature
```

- Feature chỉ import feature khác qua `index.ts` của nó. Import xuyên vào file bên trong là vi phạm.
- Thư mục `components/` chứa 80 component không liên quan là dấu hiệu tổ chức sai.

---

## 5. NestJS (apps/api)

- **Controller mỏng**: parse + validate + gọi service + trả về. Không `if` nghiệp vụ, không truy vấn DB.
- **Service** giữ transaction và điều phối. Logic thuần (state machine, tính giá, sinh ma trận variant) tách sang `domain/` — không import ORM, để test không cần DB.
- Validate mọi input ở biên, kể cả biến môi trường lúc khởi động (fail-fast).
- Domain error là class riêng (`OutOfStockError`, `InvalidTransitionError`); một exception filter toàn cục ánh xạ sang HTTP. Không rải `throw new HttpException` trong service.
- Không nuốt lỗi. Mọi `catch` hoặc xử lý được, hoặc log kèm ngữ cảnh rồi ném tiếp.
- Không lộ stack trace hay chi tiết SQL ra client.
- Raw SQL chỉ khi ORM không làm được, **luôn tham số hoá**, luôn có comment lý do.
- Endpoint truy cập theo id phải kiểm quyền sở hữu — user A không đọc được dữ liệu của user B (ràng buộc P7).

---

## 6. Vue 3 (apps/web)

- `<script setup lang="ts">` cho mọi component. Composition API, không Options API.
- Props và emits khai báo kiểu tường minh. Không `defineProps<any>`.
- **Cấm `v-html` với nội dung do người dùng nhập.** Cần render rich text thì sanitize và giải thích trong PR.
- Component > 200 dòng template → tách. Logic > vài chục dòng → đẩy sang composable.
- Mọi trang có dữ liệu phải có đủ **4 trạng thái**: loading (skeleton), lỗi, rỗng, có dữ liệu. Thiếu một trạng thái là chưa xong.
- Không gọi `fetch`/`axios` trực tiếp trong component. Đi qua API client chung.
- Route lazy-load; bundle admin tách hẳn khỏi bundle khách.
- Ảnh: định dạng hiện đại, `srcset`, lazy-load ngoài viewport.
- Accessibility tối thiểu: control bấm được phải là `<button>`/`<a>`, ảnh có `alt`, form control có `<label>`, size hết hàng dùng `disabled` + `aria-disabled` chứ không chỉ đổi màu (ràng buộc P9).

**⏳ Chốt ở S04–S06**: thư viện CSS, quản lý server state, quản lý form. Chọn khi có màn hình thật, không chọn theo danh sách.

---

## 7. Comment

- Chỉ giải thích **tại sao**, không mô tả code làm gì.
- Bắt buộc comment ở: chỗ lách quy tắc, thuật toán không hiển nhiên, workaround của thư viện, mọi `@ts-expect-error` và `!`.
- `TODO` phải kèm tên và điều kiện: `// TODO(vinh): bỏ khi có cổng thanh toán thật — S0X`. `TODO` trống bị từ chối trong review.
- Cấm comment code chết. Xoá đi, git nhớ hộ.

---

## 8. Log

- Structured JSON, có `requestId` xuyên suốt.
- **Không log PII, token, mật khẩu, nội dung cookie.**
- `console.log` chỉ tồn tại trong script CLI. Trong app dùng logger.

---

## 9. Checklist trước khi coi là code xong

- [ ] `lint` + `typecheck` xanh
- [ ] Không `any`, `@ts-ignore`, `!` thiếu comment
- [ ] Không `console.log`, code chết, file `*-v2` / `*.bak`
- [ ] Hàm < 50 dòng, file < 400 dòng
- [ ] Lỗi xử lý tường minh, không `catch {}` rỗng
- [ ] Input từ ngoài đã validate ở biên
- [ ] Không vi phạm ràng buộc nào ở `CLAUDE.md` §2

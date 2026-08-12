# Testing

Quy tắc chung. Test cụ thể của từng bước nằm trong acceptance criteria của bước đó.

---

## 1. Bốn tầng

| Tầng | Phạm vi | Công cụ | Mở từ bước |
|---|---|---|---|
| Unit (api) | Logic domain thuần: tính giá, state machine, quy tắc tồn kho, gộp giỏ, sinh ma trận variant | Vitest | S01 |
| Unit (web) | Composable, store, component có logic | Vitest + Vue Test Utils | S01 |
| Integration | Endpoint thật trên Postgres thật | Testcontainers | S02–S03 |
| E2E | Luồng sống còn | Playwright | S04 |

Không có tầng thứ năm. Không viết test cho getter/setter, cho component chỉ render props, cho code do thư viện lo.

---

## 2. Khi nào TDD là bắt buộc

Repo này **không** ép TDD toàn bộ. Ép sai chỗ thì tốn tiền thật.

**Bắt buộc viết test trước:**

- Mọi thứ trong `domain/`: tính tiền, state machine, quy tắc tồn kho, gộp giỏ, sinh ma trận variant.
- Mọi thay đổi chạm ràng buộc P1–P9 ở `CLAUDE.md` §2.
- **Mọi sửa lỗi** — regression test tái hiện lỗi phải đỏ trước, xanh sau. Không có test đỏ trước thì không chứng minh được đã sửa đúng chỗ.
- Auth, phân quyền, chống trùng đơn.

**Không bắt buộc:**

- Component trình bày thuần, layout, style.
- Config, script hạ tầng.
- Code thăm dò trong branch chưa mở PR.

---

## 3. Coverage

| Phạm vi | Ngưỡng |
|---|---|
| Toàn repo | ≥ 80% |
| `apps/api/src/modules/**/domain/**` | ≥ 90% |
| File chạm tiền hoặc tồn kho | 100% nhánh |

Bật threshold trong CI **từ bước đầu tiên có logic nghiệp vụ** (S03), không bật ở S01 khi chưa có gì để phủ.

Coverage là sàn, không phải mục tiêu. Test viết chỉ để nâng số mà không khẳng định hành vi nào là rác — từ chối trong review.

---

## 4. Cách viết test

Cấu trúc AAA. Tên test mô tả **hành vi**, không mô tả hàm:

```ts
// đúng
test('từ chối chuyển PAID → DELIVERED vì không có trong bảng transition', () => {});
test('trả 409 OUT_OF_STOCK kèm danh sách SKU thiếu khi tồn không đủ', () => {});

// sai
test('transition works', () => {});
test('testOrderService', () => {});
```

- Một test khẳng định một hành vi.
- Test phải cô lập dữ liệu — chạy song song không được đụng nhau.
- Không phụ thuộc thứ tự test, không dùng state chia sẻ.
- Không mock thứ mình sở hữu. Mock ở biên: HTTP ngoài, mailer, storage, đồng hồ.
- Thời gian: inject clock, không `sleep`. Test phụ thuộc `Date.now()` thật là test flaky.
- Tên test viết tiếng Việt được; code trong test vẫn tiếng Anh.

---

## 5. Test bắt buộc phải tồn tại

Danh sách này gắn với ràng buộc sản phẩm ở `CLAUDE.md` §2.1. Bước nào tạo ra hành vi tương ứng thì bước đó phải có test tương ứng — không có thì bước chưa xong.

| Test | Bảo vệ ràng buộc | Bước |
|---|---|---|
| 100 request đồng thời mua cùng một SKU khi tồn = 10 → đúng 10 đơn thành công, 90 lỗi, tồn về 0 | P2 | S07 |
| Retry cùng khoá chống trùng → trả đúng đơn cũ, không tạo đơn thứ hai | P3 | S07 |
| Tổng tiền = các thành phần cộng lại, luôn đúng | P1 | S07 |
| Đổi giá sau khi đặt → tổng tiền đơn cũ không đổi | P4 | S07 |
| Mọi transition hợp lệ đi được, mọi transition ngoài bảng bị từ chối | — | S08 |
| Huỷ đơn / thanh toán thất bại → tồn cộng lại đúng, có bản ghi lịch sử | P2 | S07 |
| Giỏ ẩn danh gộp vào giỏ user, cộng số lượng, chặn trần theo tồn | — | S06 |
| User A không đọc/sửa được dữ liệu của user B | P7 | S05 |
| 3 màu × 5 size → 15 variant; tắt 2 tổ hợp → 13 variant bán được | — | S03 |

---

## 6. Test đỏ

Thứ tự xử lý, không được đảo:

1. Đọc output thật. Không đoán nguyên nhân.
2. Xác định: code sai hay test sai?
3. **Code sai** → sửa code.
4. **Test sai** → sửa test, và **nói rõ trong PR là đã sửa test và tại sao**.
5. Flaky → sửa cho hết flaky hoặc quarantine kèm hạn xử lý. Không retry mù.

Cấm: `skip`, `only`, comment out, nới assertion cho vừa kết quả sai, tăng timeout để giấu race condition.

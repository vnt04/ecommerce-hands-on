# Git Workflow

Mô hình: **branch ngắn hạn → PR → CI gate → squash merge vào `main`**.

`main` luôn ở trạng thái deploy được. Không commit thẳng vào `main`.

---

## 1. Branch

```
<type>/<step-id>-<slug-ngan>
```

| Ví dụ | Dùng khi |
|---|---|
| `feat/S06-cart-merge-on-login` | Việc chính của bước |
| `fix/S06-cart-merge-quantity-cap` | Sửa lỗi |
| `chore/setup-eslint` | Việc lặt vặt không thuộc bước nào |
| `docs/adr-001-primary-key` | Chỉ đụng tài liệu |
| `infra/terraform-network-module` | Terraform / CI |

- Branch sống **≤ 3 ngày**. Lâu hơn thì bước quá to, cắt đôi.
- Rebase lên `main` trước khi mở PR. Không merge `main` vào branch tạo commit rác.

---

## 2. Commit

Conventional Commits, tiếng Anh, mô tả ở thể mệnh lệnh:

```
<type>(<scope>): <mô tả ngắn, không dấu chấm cuối>

<thân bài: tại sao, không phải cái gì>

Refs: docs/steps/S06-gio-hang/
```

**type**: `feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`
**scope**: `web` `api` `shared` `infra` `db` `ci` hoặc tên module (`orders`, `catalog`, `inventory`)

```
feat(orders): deduct stock inside order transaction

Conditional UPDATE with stock_quantity >= qty so concurrent
checkouts cannot oversell. Rows affected = 0 rolls back and
returns 409 OUT_OF_STOCK with the missing SKUs.

Refs: docs/steps/S07-dat-hang/
```

Quy tắc:

- Một commit = một thay đổi logic hoàn chỉnh. Không commit `wip`, `fix`, `update`.
- Không trộn đổi format với đổi logic trong cùng commit — diff sẽ không đọc được.
- Không trộn đổi rule/docs với đổi code trong cùng PR.
- Migration đi cùng commit với code dùng nó.

---

## 3. Pull Request

**Điều kiện mở PR:** đã qua [definition-of-done.md](definition-of-done.md).

PR body dùng `.github/pull_request_template.md`. Bắt buộc có:

- Link tới `docs/steps/S0X-<slug>/`
- Cái gì đổi và **tại sao**
- Cách kiểm chứng (lệnh + kết quả)
- Rủi ro và cách rollback
- Ảnh chụp màn hình nếu đụng UI

**Điều kiện merge:**

- [ ] CI xanh: `lint` → `typecheck` → `test` → `build`
- [ ] Coverage đạt ngưỡng ([testing.md](testing.md) §3)
- [ ] Không có secret trong diff
- [ ] Người đã tự đọc diff — không merge thứ mình không hiểu
- [ ] Nếu có ADR mới thì ADR đã nằm trong PR

Làm một mình vẫn mở PR và vẫn chờ CI. Cổng chặn không phải để làm hài lòng người khác, nó là để chặn chính mình.

**Merge:** squash merge. Tiêu đề squash commit = tiêu đề PR theo đúng format Conventional Commits. Xoá branch sau khi merge.

---

## 4. CI gate

Chạy trên mọi PR và mọi push vào `main`, có mặt từ bước đầu tiên:

```
lint → typecheck → test (unit + integration) → build
```

Thêm dần theo bước:

- S03 (bước đầu có logic nghiệp vụ): coverage threshold
- S04: E2E trên PR chạm luồng sống còn
- S09 (lên production): `npm audit`, quét secret trên **toàn bộ lịch sử** không chỉ HEAD, bundle budget

CI đỏ thì sửa CI hoặc sửa code. **Không bao giờ dùng `--no-verify`, không tắt bước CI để merge cho kịp.**

---

## 5. Migration

Quy tắc **expand / contract**, áp dụng từ migration đầu tiên (S02):

1. Migration phải tương thích ngược với code đang chạy.
2. **Không drop cột trong cùng release với code ngừng dùng cột đó.** Tách hai release.
3. Mỗi migration có đường lùi rõ ràng, hoặc ghi rõ là không lùi được và tại sao.
4. Snapshot DB thủ công trước mỗi migration lớn.
5. Trên production, migration chạy như một job riêng **trước** khi cập nhật service.

Không sửa migration đã merge. Sai thì viết migration mới.

---

## 6. Cấm commit

`.env`, secret, key, token, dump DB, `node_modules/`, `dist/`, `.terraform/`, `*.tfstate`, file ảnh nặng chưa tối ưu, file `*.bak` / `*-v2` / scratch.

Lỡ commit secret: **coi như đã lộ**. Rotate secret trước, dọn lịch sử sau. Xoá commit không cứu được thứ đã push.

# Lộ trình

Đơn vị công việc của dự án này là **bước** (step), không phải sprint và không phải một bản thiết kế tổng thể.

## 1. Luật của lộ trình

1. **Chỉ một bước được mở tại một thời điểm.** Xong mới mở bước kế.
2. **Chỉ bước đang mở có plan chi tiết.** Bước kế tiếp có phác thảo một đoạn. Các bước sau nữa chỉ có một dòng tên.
3. **Plan của bước N+1 được viết lại sau khi bước N chạy thật.** Đó là lý do không viết chi tiết trước — thứ học được ở bước N sẽ đổi bước N+1.
4. **Quyết định chốt trong bước cần nó, không chốt trước.** Mỗi bước có `decisions.md` riêng. Quyết định khó đảo ngược thì kèm ADR.
5. **Mỗi bước phải kiểm chứng được bằng lệnh chạy thật**, không phải bằng cảm giác đã xong.

Bước quá to (> 20 task hoặc > 3 ngày) thì cắt đôi, đừng cố làm cho xong.

## 2. Trạng thái

| Trạng thái | Nghĩa |
|---|---|
| `PLAN` | Đang viết plan + decisions |
| `CHỐT` | Người đã duyệt → được phép code |
| `WIP` | Đang làm |
| `DONE` | Đã merge, acceptance criteria xanh |
| `SKIP` | Bỏ. Lý do ghi trong `notes.md` |

## 3. Các bước

| # | Bước | Trạng thái | Kết quả kiểm chứng được |
|---|---|---|---|
| **S01** | [Nền móng repo](S01-nen-mong/plan.md) | **PLAN** | `pnpm dev` chạy web + api, `/healthz` trả 200, Postgres nhận kết nối, CI xanh |
| S02 | Khung ứng dụng | — | Env validate lúc khởi động, log JSON có request-id, response envelope, Prisma nối được DB, migration đầu chạy |
| S03 | Domain sản phẩm | — | Tạo được một thiết kế 3 màu × 5 size, sinh đúng 15 SKU, tắt được tổ hợp không sản xuất |
| S04 | Catalog công khai | — | Trang khách duyệt được sản phẩm, đổi swatch đổi ảnh, size hết hiển thị vô hiệu hoá |
| S05 | Tài khoản và đăng nhập | — | Đăng ký, đăng nhập, refresh token xoay vòng, guard chặn đúng |
| S06 | Giỏ hàng | — | Giỏ khách vãng lai gộp vào giỏ user khi đăng nhập |
| S07 | Đặt hàng và tồn kho | — | 100 request đồng thời trên 10 tồn → đúng 10 đơn, 90 lỗi, tồn về 0 |
| S08 | Quản lý đơn cho admin | — | Đơn đi được PAID → PROCESSING → SHIPPED → DELIVERED |
| S09 | Lên production | — | Chạy trên tên miền thật, HTTPS, deploy tự động, rollback đã thử |
| S10 | Vận hành được | — | Alarm đã kêu thật một lần trong diễn tập |

**S07 là bước rủi ro nhất của toàn dự án** (tiền + tồn kho + đồng thời). Mọi bước trước nó nên coi là chuẩn bị để bước đó làm đúng ngay lần đầu.

Từ S03 trở đi mô tả chỉ là phác thảo — sẽ viết lại khi tới lượt. Bước sau S10 chưa xếp, mở khi có số liệu yêu cầu.

## 4. Cấu trúc một bước

```
docs/steps/S01-nen-mong/
├── plan.md        # Mục tiêu, phạm vi, cách làm, acceptance criteria
├── decisions.md   # Những gì phải chốt trong bước này + cái cố tình hoãn
├── tasks.md       # Checklist thực thi
└── notes.md       # Nhật ký ghi trong lúc làm
```

Mở bước mới:

```bash
cp -r docs/steps/_template docs/steps/S0X-<slug>
```

hoặc dùng `/step-new`.

## 5. Kết thúc một bước

- [ ] Acceptance criteria trong `plan.md` đều xanh, có output lệnh chứng minh
- [ ] `decisions.md` không còn mục nào ở trạng thái "chưa chốt"
- [ ] Quyết định khó đảo ngược đã có ADR trong `docs/decisions/`
- [ ] Bất biến mới phát sinh đã thêm vào `CLAUDE.md` §2
- [ ] `notes.md` ghi lại bất ngờ và nợ kỹ thuật
- [ ] Bảng ở §3 đổi trạng thái sang `DONE`
- [ ] **Viết plan chi tiết cho bước kế tiếp, dựa trên thứ vừa học được**

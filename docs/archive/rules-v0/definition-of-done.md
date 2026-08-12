# Definition of Done

Checklist chạy **trước khi mở PR**. Chưa qua hết thì chưa xong, dù code đã chạy được trên máy.

Copy checklist này vào PR body và tick thật.

---

## A. Chức năng

- [ ] Mọi acceptance criteria trong `spec.md` đều đạt
- [ ] Mọi task trong `tasks.md` đã tick
- [ ] Phạm vi đúng bằng plan đã CHỐT — không thừa, không thiếu
- [ ] Đã thử tay luồng chính ít nhất một lần, không chỉ dựa vào test

## B. Code

- [ ] `pnpm lint` xanh
- [ ] `pnpm typecheck` xanh
- [ ] Không `any`, `@ts-ignore`, `!` thiếu comment
- [ ] Không `console.log`, code chết, file `*-v2` / `*.bak`
- [ ] Hàm < 50 dòng, file < 400 dòng (vượt thì đã giải thích)
- [ ] Không vi phạm ràng buộc nào ở `CLAUDE.md` §2

## C. Test

- [ ] `pnpm test` xanh, không `skip` / `only`
- [ ] Coverage đạt ngưỡng ([testing.md](testing.md) §3)
- [ ] Bug fix có regression test **đã đỏ trước khi sửa**
- [ ] Logic trong `domain/` có unit test không cần DB
- [ ] Chạm luồng sống còn → E2E tương ứng xanh

## D. Lỗi và biên

- [ ] Input từ ngoài đã validate (DTO + Zod)
- [ ] Lỗi trả về đúng envelope, có `code` máy đọc được
- [ ] Không `catch {}` rỗng, không nuốt lỗi
- [ ] UI có đủ 4 trạng thái: loading, lỗi, rỗng, có dữ liệu
- [ ] Trường hợp biên đã nghĩ tới: rỗng, hết hàng, mất mạng, double-click, số lượng 0/âm/vượt tồn

## E. Bảo mật — bắt buộc khi chạm auth / tiền / tồn kho / input người dùng / upload

- [ ] Không secret trong diff, không secret trong `VITE_*`
- [ ] Quyền kiểm ở backend, không chỉ ở frontend
- [ ] Endpoint theo id đã kiểm quyền sở hữu (IDOR)
- [ ] Query tham số hoá, raw SQL đã tự kiểm
- [ ] Không `v-html` với nội dung người dùng nhập
- [ ] Rate limit cho endpoint auth và endpoint tạo đơn
- [ ] Không log PII / token / mật khẩu
- [ ] Lỗi trả về không lộ stack trace, chi tiết SQL, hay việc email có tồn tại hay không

## F. Dữ liệu

- [ ] Migration tương thích ngược (expand/contract)
- [ ] Migration đã chạy thử trên DB local có dữ liệu seed
- [ ] Thay đổi tồn kho có `InventoryMovement`
- [ ] Thay đổi trạng thái đơn đi qua state machine và có `OrderStatusHistory`

## G. Hiệu năng (kiểm nhanh, không tối ưu sớm)

- [ ] Không N+1 mới ở endpoint danh sách
- [ ] Endpoint trả list có `limit` (mặc định 20, tối đa 100)
- [ ] Không thêm dependency nặng vào bundle khách mà không cân nhắc

## H. Tài liệu

- [ ] `notes.md` của feature ghi lại quyết định và đánh đổi đã phát sinh
- [ ] Quyết định khó đảo ngược → có ADR trong cùng PR
- [ ] `decisions.md` của bước không còn mục nào ở §1 Chờ chốt
- [ ] `docs/steps/README.md` cập nhật trạng thái bước
- [ ] README cập nhật nếu bước setup đổi

---

## Câu hỏi cuối

> Nếu cái này hỏng lúc 2 giờ sáng, log và alarm có đủ để biết nó hỏng ở đâu không?

Trả lời "không" thì quay lại phần D.

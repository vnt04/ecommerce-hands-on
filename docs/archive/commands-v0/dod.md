---
description: Chạy Definition of Done trên thay đổi hiện tại trước khi mở PR
argument-hint: [step id, ví dụ S01 — bỏ trống thì tự suy từ branch]
---

Chạy Definition of Done cho: **$ARGUMENTS**

1. `git status` và `git diff main...HEAD` để biết chính xác đã đổi gì. Không dựa vào trí nhớ của phiên làm việc.
2. Đọc `plan.md`, `decisions.md`, `tasks.md` của bước tương ứng.
3. Chạy **từng acceptance criteria** trong `plan.md` §5, không chỉ chạy test. Dán output thật của từng cái.
4. Chạy:
   ```
   pnpm lint && pnpm typecheck && pnpm test
   ```
5. Đi qua từng mục trong `docs/rules/definition-of-done.md`. Với mỗi mục ghi một trong ba:
   - ✅ đạt — kèm bằng chứng (đường dẫn file, dòng output)
   - ❌ chưa đạt — kèm việc cần làm
   - ➖ không áp dụng ở bước này — kèm lý do
6. Với code chạm auth / tiền / tồn kho / input người dùng / upload: rà kỹ mục E.
7. Đối chiếu diff với **ràng buộc P1–P9** ở `CLAUDE.md` §2.1 và bất biến kỹ thuật ở §2.2. Nêu rõ cái nào bị chạm và vì sao vẫn giữ được.
8. Kiểm `decisions.md`: §1 phải trống. Còn mục chờ chốt nghĩa là bước chưa xong.

Kết luận đúng một trong ba: **SẴN SÀNG MỞ PR** / **CÒN THIẾU** (liệt kê) / **CÓ VẤN ĐỀ NGHIÊM TRỌNG** (mô tả).

Cấm kết luận "sẵn sàng" khi chưa có output lệnh thật.

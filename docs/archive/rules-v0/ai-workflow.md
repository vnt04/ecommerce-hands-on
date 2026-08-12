# AI Workflow

Cách làm việc với AI trong repo này. Áp dụng cho Claude Code và mọi trợ lý code khác.

Tiền đề: **AI viết phần lớn code, người chịu trách nhiệm cuối cùng.** Vì vậy mọi thứ AI làm phải kiểm chứng được bởi người, trong thời gian ngắn hơn thời gian nó tự viết lại.

---

## 1. Vòng lặp chuẩn

```
Explore → Plan → CHỐT → Implement → Verify → Review → PR
```

### 1.1 Explore (đọc trước, không đoán)

Đầu mỗi phiên làm việc, đọc theo thứ tự:

1. `CLAUDE.md` — ràng buộc và quy trình.
2. `docs/steps/README.md` — đang ở bước nào.
3. `plan.md`, `decisions.md`, `notes.md` của bước đang mở.
4. `docs/decisions/` — ADR chạm tới vùng sắp sửa.
5. Code thật của module liên quan.

Cấm phỏng đoán API, tên bảng, tên field. Không tìm thấy thì hỏi.

### 1.2 Plan

Tạo `docs/steps/S0X-<slug>/` từ `docs/steps/_template/`. Điền:

- `plan.md` — mục tiêu, phạm vi trong/ngoài, acceptance criteria, cách làm, rủi ro.
- `decisions.md` — cái gì bước này phải chốt, cái gì **cố tình hoãn**.
- `tasks.md` — checklist thực thi.

Plan tốt phải trả lời được: *lệnh nào chứng minh nó xong*, *cái gì cố tình không làm lần này*, *cái gì có thể hỏng*.

Plan dài hơn 20 task là dấu hiệu bước quá to → cắt đôi.

**Không chốt thứ bước này chưa cần.** Câu hỏi chưa cần đáp án → đưa xuống `decisions.md` §3, không tự chọn rồi đi tiếp.

### 1.3 CHỐT (cổng chặn)

AI **dừng lại**, trình bày plan, chờ người trả lời đúng chữ `CHỐT`.

- Chưa có `CHỐT` → chỉ được đọc file và sửa file trong `docs/`.
- `CHỐT` chỉ có hiệu lực với plan đang bàn, không phải giấy phép mở cho các việc sau.
- Người trả lời "ok làm đi" cũng tính là chốt; im lặng thì không.

Miễn plan cho sửa lỗi nhỏ — định nghĩa ở `CLAUDE.md` §3. Không thoả đủ điều kiện thì không phải sửa lỗi nhỏ.

### 1.4 Implement

- Bám `tasks.md`, tick từng mục ngay khi xong.
- **Một task một lần.** Không nhảy sang task khác khi task hiện tại chưa xanh.
- Phát hiện plan sai giữa chừng → dừng, báo, sửa plan, xin chốt lại. Không âm thầm đi đường khác.
- Chỉ sửa file có trong plan. Cần sửa file ngoài danh sách → báo lý do trước.

### 1.5 Verify

Không có lệnh nào chạy thật thì không có gì được gọi là xong.

```bash
pnpm lint && pnpm typecheck && pnpm test
```

- Dán output thật vào câu trả lời, không mô tả lại.
- Test đỏ thì nói là đỏ, kèm output. Không "chắc là do môi trường".
- Bỏ qua bước nào phải nói rõ đã bỏ qua bước nào và tại sao.

### 1.6 Review

Tự soát theo [definition-of-done.md](definition-of-done.md). Với code chạm auth / tiền / tồn kho / input người dùng, chạy thêm mục E của checklist đó.

### 1.7 PR

Theo [git-workflow.md](git-workflow.md). PR body phải link tới `docs/steps/S0X-<slug>/`.

---

## 2. Điều cấm tuyệt đối

| Cấm | Vì sao |
|---|---|
| Sửa test cho pass thay vì sửa code | Test là thứ duy nhất nói code có đúng không. Test sai thì sửa test — nhưng phải nói ra là đang sửa test và tại sao. |
| `skip` / `only` / comment out test rồi commit | Test bị tắt là test không tồn tại, nhưng vẫn tính vào coverage một cách giả tạo. |
| Hardcode dữ liệu để demo chạy được | Thứ chạy bằng dữ liệu giả là thứ chưa làm. |
| Bịa API/field/lệnh không có thật | Sai kiểu này tốn nhiều thời gian sửa hơn là hỏi. |
| Thêm dependency mà không hỏi | Mỗi dependency là một khoản nợ bảo trì và một bề mặt tấn công. |
| Đổi schema/migration ngoài plan | Migration khó đảo ngược hơn code. |
| `console.log` trong code production | Dùng logger có cấu trúc |
| Commit secret, `.env`, key, dump DB | Đã push là coi như đã lộ, phải rotate |
| Tạo file rác: `*-v2.ts`, `*-new.ts`, `*.bak`, `test.js` ở root | Sửa file gốc. Cần bản nháp thì để trong scratchpad ngoài repo. |
| Viết lại module đang chạy được vì "code cũ xấu" | Refactor là một bước riêng, có plan riêng. |
| Comment mô tả code làm gì | Comment chỉ giải thích *tại sao*. Code tự nói nó làm gì. |
| Nói "đã xong" khi chưa chạy lệnh | Xem §1.5. |

---

## 3. Phạm vi một lần thay đổi

| Ngưỡng | Giá trị | Vượt thì |
|---|---|---|
| File chạm trong một PR | ≤ 20 | Cắt PR |
| Dòng thay đổi trong một PR (không tính lock file, snapshot, generated) | ≤ 600 | Cắt PR |
| Task trong plan của một bước | ≤ 20 | Cắt bước |
| Thời gian một task | ≤ nửa ngày người | Cắt task |

Ngưỡng không phải luật vật lý — nhưng vượt ngưỡng thì phải nói ra và giải thích, không im lặng vượt.

---

## 4. Dùng sub-agent

Chỉ dùng khi việc thật sự độc lập và tốn context, không dùng cho mọi thứ.

| Tình huống | Agent |
|---|---|
| Bước phức tạp, cần plan | `ecc:planner` |
| Quyết định kiến trúc → sẽ sinh ADR | `ecc:architect` |
| Vừa viết xong code | `ecc:code-reviewer` |
| Code chạm auth / tiền / input người dùng / upload | `ecc:security-reviewer` |
| Code TypeScript/Vue/Nest | `ecc:typescript-reviewer` |
| Build hoặc type đỏ và không rõ nguyên nhân | `ecc:build-error-resolver` |
| Query/schema/migration Postgres | `ecc:database-reviewer` |
| Luồng E2E sống còn | `ecc:e2e-runner` |

Các review độc lập nhau thì chạy song song trong cùng một lượt. Kết quả agent là **đầu vào để thẩm định**, không phải kết luận — agent nói sai thì bác bỏ, không làm theo.

---

## 5. Quản lý context

- Không đọc `node_modules/`, `dist/`, `.terraform/`, lock file, snapshot.
- Đọc file lớn theo đoạn cần, không đọc cả file rồi bỏ 90%.
- Dừng việc giữa chừng thì dồn trạng thái vào `docs/steps/S0X-*/notes.md` trước — để phiên sau đọc notes là đủ, không phải đọc lại toàn bộ hội thoại.
- Việc dài, nhiều bước → dùng todo list để người nhìn thấy tiến độ và chặn sớm khi thấy sai hướng.
- Phiên đã dài và bắt đầu lặp lại/quên rule → nén context, không cố kéo dài.

---

## 6. AI báo cáo như thế nào

Mỗi lượt trả lời sau khi làm việc, theo đúng thứ tự này:

1. **Đã làm gì** — 1–3 câu, file nào bị đụng (`path:line`).
2. **Kết quả kiểm chứng** — lệnh đã chạy + output thật.
3. **Điều cần biết** — đánh đổi đã chấp nhận, thứ đã bỏ qua, giả định đang đặt.
4. **Bước tiếp theo** — hoặc câu hỏi chặn, nếu có.

Không viết lại toàn bộ code vừa sinh vào câu trả lời. Không tổng kết dài dòng thứ người vừa đọc trong diff.

Cấm dùng từ "hoàn thành", "đã xong", "production-ready" khi chưa có output lệnh chứng minh.

---

## 7. Người cần làm gì

Rule này ràng buộc cả hai phía. Người:

- Trả lời `CHỐT` hoặc yêu cầu sửa plan, không im lặng để AI tự đoán là được duyệt.
- Đọc diff trước khi merge. Không merge thứ mình không hiểu.
- Rule sai thì sửa rule bằng PR, không phá lệ từng lần.

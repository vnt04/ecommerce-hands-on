# Rules

Bộ quy tắc làm việc của ShopFlow. Điểm vào là [`/CLAUDE.md`](../../CLAUDE.md).

| File | Trả lời câu hỏi |
|---|---|
| [ai-workflow.md](ai-workflow.md) | AI được làm gì, theo trình tự nào, và bị cấm làm gì? |
| [code-style.md](code-style.md) | Code viết ra trông như thế nào? |
| [testing.md](testing.md) | Cái gì phải có test, test loại nào, bao nhiêu là đủ? |
| [git-workflow.md](git-workflow.md) | Branch/commit/PR đặt tên và merge ra sao? |
| [documentation.md](documentation.md) | Tài liệu nào tồn tại, cập nhật khi nào? |
| [definition-of-done.md](definition-of-done.md) | Khi nào được gọi là xong? |

## Nguyên tắc của chính bộ rule này

1. **Rule phải kiểm được.** "Viết code sạch" không phải rule. "Hàm < 50 dòng" là rule.
2. **Rule phải có lý do.** Rule không giải thích được tại sao thì sẽ bị lách hoặc bị bỏ.
3. **Không lặp lại plan của bước.** Rule nói *luôn luôn thế nào*; plan của bước nói *lần này làm gì*.
4. **Sửa rule bằng PR riêng.** Không nhét thay đổi rule vào PR làm bước.

/**
 * JSON.stringify ném lỗi khi gặp bigint, mà mọi số tiền trong hệ thống đều là
 * bigint (ADR-003). Hàm này được gắn vào tầng serialize của Express nên áp dụng
 * cho toàn bộ response — không endpoint nào phải tự nhớ chuyển đổi.
 *
 * Không xử lý tập trung ở đây thì lỗi sẽ chỉ lộ ra ở S07, khi endpoint đầu tiên
 * trả về số tiền, và biểu hiện là một lỗi 500 khó lần ra nguyên nhân.
 */
export function bigIntReplacer(_key: string, value: unknown): unknown {
      return typeof value === 'bigint' ? value.toString() : value;
}

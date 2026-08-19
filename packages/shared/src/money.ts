import { z } from 'zod';

/**
 * Số tiền trong hệ thống luôn là số nguyên, đơn vị đồng (ràng buộc R1 trong CLAUDE.md).
 * Dùng bigint thay vì number để không thể vô tình chia ra số thực, và để không
 * chạm trần an toàn của number khi cộng dồn doanh thu.
 */
export type Vnd = bigint;

const THOUSANDS_SEPARATOR = '.';
const CURRENCY_SUFFIX = ' ₫';
const INTEGER_STRING = /^-?\d+$/;

/**
 * Định dạng số tiền theo quy ước Việt Nam: 299000n thành "299.000 ₫".
 *
 * Không dùng Intl.NumberFormat vì kết quả phụ thuộc phiên bản ICU của Node,
 * mà máy phát triển (Node 24) và container (Node 22) không dùng cùng phiên bản.
 * Tự nhóm chữ số cho kết quả giống nhau ở mọi nơi.
 */
export function formatVnd(amount: Vnd): string {
      const isNegative = amount < 0n;
      const digits = (isNegative ? -amount : amount).toString();
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);

      return `${isNegative ? '-' : ''}${grouped}${CURRENCY_SUFFIX}`;
}

/**
 * Số tiền đi qua JSON dưới dạng chuỗi chữ số, không phải number.
 *
 * Hai lý do. Thứ nhất, JSON.stringify ném lỗi khi gặp bigint nên bắt buộc phải
 * có một bước chuyển đổi dù chọn kiểu gì. Thứ hai, dùng number sẽ mở lại cánh
 * cửa cho phép chia ra số thực mà trình biên dịch không chặn được.
 *
 * Schema này là nơi duy nhất định nghĩa phép chuyển đổi đó. Cấm endpoint tự
 * viết bộ chuyển đổi riêng — lệch một chỗ là tiền hiển thị sai một chỗ.
 */
export const vndFromJson = z
      .string()
      .regex(INTEGER_STRING, 'Số tiền phải là chuỗi chữ số nguyên, đơn vị đồng')
      .transform((value): Vnd => BigInt(value));

/** Chiều ngược lại: bigint sang chuỗi để đưa vào response. */
export function vndToJson(amount: Vnd): string {
      return amount.toString();
}

/**
 * Định dạng số tiền nhận từ API, vốn là chuỗi chữ số.
 *
 * Tồn tại để không ai phải tự viết `Number(value)` ở tầng giao diện: cách đó chạy
 * đúng với mọi giá của cửa hàng áo thun nên lỗi không bao giờ lộ ra, nhưng nó mở
 * lại đúng cánh cửa mà quy tắc số nguyên đóng lại.
 */
export function formatVndFromJson(amount: string): string {
      return formatVnd(BigInt(amount));
}

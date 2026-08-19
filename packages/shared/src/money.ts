/**
 * Số tiền trong hệ thống luôn là số nguyên, đơn vị đồng (ràng buộc R1 trong CLAUDE.md).
 * Dùng bigint thay vì number để không thể vô tình chia ra số thực, và để không
 * chạm trần an toàn của number khi cộng dồn doanh thu.
 */
export type Vnd = bigint;

const THOUSANDS_SEPARATOR = '.';
const CURRENCY_SUFFIX = ' ₫';

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

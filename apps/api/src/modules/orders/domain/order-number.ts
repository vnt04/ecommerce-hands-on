/** Tiền tố cố định để mã đơn nhận ra được khi khách đọc qua điện thoại. */
const PREFIX = 'SF';

/** Số chữ số của phần thứ tự trong ngày. Bốn chữ số đủ cho 9999 đơn mỗi ngày. */
const SEQUENCE_DIGITS = 4;

/**
 * Ghép mã đơn công khai theo ADR-002, dạng `SF-260819-0001`.
 *
 * Phần ngày lấy theo giờ Việt Nam chứ không theo UTC: đơn đặt lúc 23 giờ ngày 19
 * mà mang mã ngày 20 thì bộ phận hỗ trợ tra không ra.
 */
export function formatOrderNumber(day: Date, sequence: number): string {
      const year = String(day.getUTCFullYear() % 100).padStart(2, '0');
      const month = String(day.getUTCMonth() + 1).padStart(2, '0');
      const date = String(day.getUTCDate()).padStart(2, '0');

      return PREFIX + '-' + year + month + date + '-' + String(sequence).padStart(SEQUENCE_DIGITS, '0');
}

/** Chênh lệch giờ Việt Nam so với UTC. Việt Nam không đổi giờ theo mùa. */
const VIETNAM_UTC_OFFSET_HOURS = 7;

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

/**
 * Ngày theo giờ Việt Nam của một thời điểm, trả về dưới dạng `Date` chỉ có phần ngày.
 *
 * Dùng làm khoá của bảng bộ đếm. Cột là `DATE` nên phần giờ bị bỏ đi, nhưng phải
 * tự dịch múi giờ trước, nếu không đơn đặt buổi tối rơi sang bộ đếm của ngày sau.
 */
export function vietnamDayOf(instant: Date): Date {
      const shifted = new Date(instant.getTime() + VIETNAM_UTC_OFFSET_HOURS * MILLISECONDS_PER_HOUR);

      return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

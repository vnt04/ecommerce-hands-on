import type { OrderStatus, PaymentStatus } from '@shopflow/shared';

/**
 * Nhãn tiếng Việt của trạng thái đơn.
 *
 * Gom về một chỗ vì bốn màn hình cùng dùng: đơn của khách, chi tiết đơn, danh
 * sách quản trị, chi tiết quản trị. Chép ra bốn nơi thì sớm muộn có nơi lệch.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      SHIPPING: 'Đang giao',
      DELIVERED: 'Đã giao',
      CANCELLED: 'Đã huỷ',
};

export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
      PENDING: 'bg-amber-100 text-amber-900',
      CONFIRMED: 'bg-blue-100 text-blue-900',
      SHIPPING: 'bg-blue-100 text-blue-900',
      DELIVERED: 'bg-green-100 text-green-900',
      CANCELLED: 'bg-gray-200 text-gray-700',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
      UNPAID: 'Chưa thu tiền',
      PAID: 'Đã thu tiền',
      REFUNDED: 'Đã hoàn tiền',
};

/** Nhãn của nút thực hiện bước chuyển, viết ở dạng hành động chứ không dạng trạng thái. */
export const TRANSITION_LABELS: Record<OrderStatus, string> = {
      PENDING: 'Trả về chờ xác nhận',
      CONFIRMED: 'Xác nhận đơn',
      SHIPPING: 'Bắt đầu giao',
      DELIVERED: 'Đánh dấu đã giao',
      CANCELLED: 'Huỷ đơn',
};

export function formatDateTime(value: string): string {
      return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatDate(value: string): string {
      return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

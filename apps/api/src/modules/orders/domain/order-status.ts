import type { OrderStatus } from '@shopflow/shared';

/**
 * Máy trạng thái đơn hàng.
 *
 * Trạng thái không phải một ô chữ tự do. Đơn đã giao không được quay về chờ xác
 * nhận, đơn đã huỷ không được giao. Không có bảng này thì một lần bấm nhầm biến
 * dữ liệu đơn thành thứ không giải thích được, và báo cáo doanh thu sai theo.
 *
 * `CANCELLED` và `DELIVERED` là trạng thái cuối: không có đường nào đi tiếp.
 * Trả hàng và hoàn tiền là nghiệp vụ khác, chưa xếp bước.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['SHIPPING', 'CANCELLED'],
      // Hàng đã rời kho thì không huỷ được nữa; xử lý bằng quy trình trả hàng.
      SHIPPING: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
};

/**
 * Trạng thái mà khách tự chuyển được, ngoài ra đều phải là quản trị viên.
 *
 * Khách chỉ huỷ được khi đơn còn chờ xác nhận. Đã xác nhận nghĩa là người bán đã
 * bắt đầu soạn hàng, và lúc đó việc huỷ cần một cuộc trao đổi.
 */
const CUSTOMER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
      PENDING: ['CANCELLED'],
      CONFIRMED: [],
      SHIPPING: [],
      DELIVERED: [],
      CANCELLED: [],
};

/** Trạng thái đã trừ tồn kho và cần cộng trả khi huỷ. */
const HOLDS_STOCK: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED'];

export function allowedTransitions(from: OrderStatus, isAdmin: boolean): readonly OrderStatus[] {
      return isAdmin ? TRANSITIONS[from] : CUSTOMER_TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus, isAdmin: boolean): boolean {
      return allowedTransitions(from, isAdmin).includes(to);
}

/**
 * Huỷ một đơn ở trạng thái này có phải cộng trả tồn kho hay không.
 *
 * Đơn đã huỷ rồi thì không, và đó là thứ chặn việc cộng trả hai lần khi bấm huỷ
 * hai lần. Chốt chặn thật nằm ở câu lệnh `UPDATE ... WHERE status = <cũ>`, còn
 * hàm này chỉ nói lên ý định.
 */
export function shouldRestoreStock(from: OrderStatus): boolean {
      return HOLDS_STOCK.includes(from);
}

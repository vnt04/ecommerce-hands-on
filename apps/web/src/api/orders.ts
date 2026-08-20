import type { OrderDetail, OrderSummary, ShippingInfo } from '@shopflow/shared';

import { apiGet, apiPost } from './client.js';

/**
 * Sinh khoá chống trùng cho một lần đặt hàng.
 *
 * Khoá phải được sinh **một lần** cho mỗi lần khách quyết định đặt, rồi giữ nguyên
 * qua mọi lần thử lại. Sinh lại mỗi lần gửi thì chốt chặn trở nên vô nghĩa.
 */
export function newIdempotencyKey(): string {
      return crypto.randomUUID();
}

export function placeOrder(shipping: ShippingInfo, idempotencyKey: string): Promise<OrderDetail> {
      return apiPost<OrderDetail>('/orders', shipping, { 'Idempotency-Key': idempotencyKey }).then((result) => result.data);
}

export function fetchOrders(): Promise<OrderSummary[]> {
      return apiGet<OrderSummary[]>('/orders').then((result) => result.data);
}

export function fetchOrder(orderNumber: string): Promise<OrderDetail> {
      return apiGet<OrderDetail>('/orders/' + encodeURIComponent(orderNumber)).then((result) => result.data);
}

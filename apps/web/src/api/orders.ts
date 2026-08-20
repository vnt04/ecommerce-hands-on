import type {
      AdminOrderFilters,
      AdminOrderSummary,
      Meta,
      OrderDetail,
      OrderDetailWithHistory,
      OrderStatus,
      OrderSummary,
      PaymentStatus,
      ShippingInfo,
} from '@shopflow/shared';

import { apiGet, apiPatch, apiPost } from './client.js';

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

export function fetchOrder(orderNumber: string): Promise<OrderDetailWithHistory> {
      return apiGet<OrderDetailWithHistory>('/orders/' + encodeURIComponent(orderNumber)).then((result) => result.data);
}

export function cancelOrder(orderNumber: string, note?: string): Promise<OrderDetailWithHistory> {
      return apiPost<OrderDetailWithHistory>('/orders/' + encodeURIComponent(orderNumber) + '/cancel', { note }).then(
            (result) => result.data,
      );
}

export function fetchAdminOrders(filters: AdminOrderFilters): Promise<{ items: AdminOrderSummary[]; meta?: Meta }> {
      return apiGet<AdminOrderSummary[]>('/admin/orders', {
            status: filters.status,
            from: filters.from,
            to: filters.to,
            search: filters.search,
            page: filters.page,
      }).then((result) => ({ items: result.data, meta: result.meta }));
}

export function fetchAdminOrder(orderNumber: string): Promise<OrderDetailWithHistory> {
      return apiGet<OrderDetailWithHistory>('/admin/orders/' + encodeURIComponent(orderNumber)).then((result) => result.data);
}

export function updateAdminOrder(
      orderNumber: string,
      change: { status?: OrderStatus; paymentStatus?: PaymentStatus; note?: string },
): Promise<OrderDetailWithHistory> {
      return apiPatch<OrderDetailWithHistory>('/admin/orders/' + encodeURIComponent(orderNumber), change).then((result) => result.data);
}

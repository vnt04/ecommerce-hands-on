/**
 * Hợp đồng dữ liệu của API đơn hàng.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003. Mọi thời điểm là
 * chuỗi ISO 8601 kèm múi giờ.
 */

import { z } from 'zod';

import { vndJson } from './money.js';
import { apiSchema } from './openapi-registry.js';

export const orderStatusSchema = apiSchema('OrderStatus', z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED']));

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentMethodSchema = apiSchema('PaymentMethod', z.enum(['COD', 'GATEWAY']));

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = apiSchema('PaymentStatus', z.enum(['UNPAID', 'PAID', 'REFUNDED']));

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Thông tin giao hàng. Chép vào đơn tại thời điểm đặt và không tham chiếu tới đâu:
 * sửa hồ sơ tài khoản không được phép chạm vào đơn đã đặt.
 */
export const shippingInfoSchema = apiSchema(
      'ShippingInfo',
      z.object({
            recipientName: z.string(),
            recipientPhone: z.string(),
            addressLine: z.string(),
            ward: z.string(),
            district: z.string(),
            province: z.string(),
            note: z.string().optional(),
      }),
);

export type ShippingInfo = z.infer<typeof shippingInfoSchema>;

/** Một dòng đơn. Tên sản phẩm và màu là bản chép, không đọc từ catalog. */
export const orderLineSchema = apiSchema(
      'OrderLine',
      z.object({
            sku: z.string(),
            productName: z.string(),
            productSlug: z.string(),
            colorName: z.string(),
            sizeName: z.string(),
            quantity: z.number().int(),
            unitPrice: vndJson,
            lineTotal: vndJson,
      }),
);

export type OrderLine = z.infer<typeof orderLineSchema>;

/** Đủ để dựng một hàng trong danh sách đơn, không cần tải từng dòng. */
export const orderSummarySchema = apiSchema(
      'OrderSummary',
      z.object({
            orderNumber: z.string(),
            status: orderStatusSchema,
            paymentMethod: paymentMethodSchema,
            paymentStatus: paymentStatusSchema,
            placedAt: z.iso.datetime(),
            itemCount: z.number().int(),
            total: vndJson,
      }),
);

export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderDetailSchema = apiSchema(
      'OrderDetail',
      orderSummarySchema.extend({
            lines: z.array(orderLineSchema),
            shipping: shippingInfoSchema,
            subtotal: vndJson,
            shippingFee: vndJson,
      }),
);

export type OrderDetail = z.infer<typeof orderDetailSchema>;

/** Mã lỗi riêng của luồng đặt hàng, đi kèm `CONFLICT` để giao diện chỉ đúng dòng hỏng. */
export const orderConflictReasonSchema = apiSchema(
      'OrderConflictReason',
      z.enum(['CART_EMPTY', 'OUT_OF_STOCK', 'NOT_SELLABLE', 'IN_PROGRESS']),
);

export type OrderConflictReason = z.infer<typeof orderConflictReasonSchema>;

/** Chi tiết đi kèm lỗi `CONFLICT`, cho biết dòng nào chặn và còn lại bao nhiêu. */
export const orderConflictDetailSchema = apiSchema(
      'OrderConflictDetail',
      z.object({
            reason: orderConflictReasonSchema,
            sku: z.string().optional(),
            availableQuantity: z.number().int().optional(),
      }),
);

export type OrderConflictDetail = z.infer<typeof orderConflictDetailSchema>;

/** Một dòng lịch sử: đúng một thay đổi, hoặc trạng thái đơn, hoặc trạng thái thanh toán. */
export const orderHistoryEntrySchema = apiSchema(
      'OrderHistoryEntry',
      z.intersection(
            z.object({
                  at: z.iso.datetime(),
                  changedBy: z.string().nullable().meta({ description: 'Tên người thực hiện. Rỗng nghĩa là do hệ thống' }),
                  note: z.string().nullable(),
            }),
            z.discriminatedUnion('kind', [
                  z.object({ kind: z.literal('STATUS'), from: orderStatusSchema.nullable(), to: orderStatusSchema }),
                  z.object({ kind: z.literal('PAYMENT'), from: paymentStatusSchema.nullable(), to: paymentStatusSchema }),
            ]),
      ),
);

export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;

export const orderDetailWithHistorySchema = apiSchema(
      'OrderDetailWithHistory',
      orderDetailSchema.extend({
            history: z.array(orderHistoryEntrySchema),
            allowedTransitions: z
                  .array(orderStatusSchema)
                  .meta({ description: 'Bước chuyển hợp lệ từ trạng thái hiện tại, đối với người đang xem' }),
      }),
);

export type OrderDetailWithHistory = z.infer<typeof orderDetailWithHistorySchema>;

/** Hàng trong danh sách đơn của quản trị viên: đủ để xử lý mà không phải mở từng đơn. */
export const adminOrderSummarySchema = apiSchema(
      'AdminOrderSummary',
      orderSummarySchema.extend({
            recipientName: z.string(),
            recipientPhone: z.string(),
            province: z.string(),
      }),
);

export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

/** Tham số lọc phía client. Không phải hình dạng response nên không đăng ký vào tài liệu. */
export type AdminOrderFilters = {
      status?: OrderStatus;
      /** Ngày đặt, dạng `YYYY-MM-DD` theo giờ Việt Nam. */
      from?: string;
      to?: string;
      /** Mã đơn hoặc số điện thoại người nhận. */
      search?: string;
      page?: number;
};

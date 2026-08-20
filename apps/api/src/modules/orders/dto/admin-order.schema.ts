import { z } from 'zod';

const orderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED']);
const paymentStatusSchema = z.enum(['UNPAID', 'PAID', 'REFUNDED']);

const MAX_NOTE_LENGTH = 500;
const MAX_SEARCH_LENGTH = 50;

/**
 * Thân yêu cầu của `PATCH /admin/orders/:code`.
 *
 * Đúng một trong hai trường được phép có mặt. Cho phép cả hai nghĩa là một lần
 * gọi sinh hai dòng lịch sử với cùng một lý do, và không còn nói được thao tác
 * nào là thao tác nào.
 */
export const updateOrderSchema = z
      .object({
            status: orderStatusSchema.optional(),
            paymentStatus: paymentStatusSchema.optional(),
            note: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
      })
      .refine(
            (value) => (value.status === undefined) !== (value.paymentStatus === undefined),
            'Nêu đúng một trong hai: status hoặc paymentStatus',
      );

export type UpdateOrderBody = z.infer<typeof updateOrderSchema>;

export const cancelOrderSchema = z.object({
      note: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
});

export type CancelOrderBody = z.infer<typeof cancelOrderSchema>;

/** Ngày dạng `YYYY-MM-DD`, hiểu theo giờ Việt Nam. */
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminOrderQuerySchema = z.object({
      status: orderStatusSchema.optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
      search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
      page: z.coerce.number().int().min(1).default(1),
});

export type AdminOrderQueryInput = z.infer<typeof adminOrderQuerySchema>;

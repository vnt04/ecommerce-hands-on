/**
 * Hợp đồng dữ liệu của API giỏ hàng.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003.
 */

import { z } from 'zod';

import { vndJson } from './money.js';
import { apiSchema } from './openapi-registry.js';

export const cartLineSchema = apiSchema(
      'CartLine',
      z.object({
            sku: z.string(),
            productSlug: z.string(),
            productName: z.string(),
            colorName: z.string(),
            sizeName: z.string(),
            quantity: z.number().int(),
            unitPrice: vndJson.meta({ description: 'Giá hiện tại, chuỗi chữ số đơn vị đồng' }),
            lineTotal: vndJson,
            availableQuantity: z.number().int().meta({ description: 'Số lượng tối đa còn mua được ngay lúc này' }),
            isOutOfStock: z.boolean(),
            hasPriceChanged: z.boolean().meta({ description: 'Giá đã đổi kể từ lúc thêm vào giỏ' }),
      }),
);

export type CartLine = z.infer<typeof cartLineSchema>;

export const cartViewSchema = apiSchema(
      'CartView',
      z.object({
            lines: z.array(cartLineSchema),
            subtotal: vndJson,
            itemCount: z.number().int(),
      }),
);

export type CartView = z.infer<typeof cartViewSchema>;

/** Kết quả một thao tác ghi: giỏ sau thay đổi, kèm số lượng thực nhận nếu bị chặn trần. */
export const cartMutationResultSchema = apiSchema(
      'CartMutationResult',
      z.object({
            cart: cartViewSchema,
            adjustedQuantity: z
                  .number()
                  .int()
                  .optional()
                  .meta({ description: 'Có mặt nghĩa là số lượng đã bị chặn xuống theo tồn hiện có' }),
      }),
);

export type CartMutationResult = z.infer<typeof cartMutationResultSchema>;

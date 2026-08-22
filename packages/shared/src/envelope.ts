import { z } from 'zod';

import { errorCodeSchema } from './errors.js';
import { apiSchema } from './openapi-registry.js';

/**
 * Mọi response của API dùng chung một vỏ bọc. Frontend nhờ đó chỉ cần một
 * hàm xử lý duy nhất thay vì đoán hình dạng dữ liệu theo từng endpoint.
 */
export const metaSchema = apiSchema(
      'Meta',
      z.object({
            page: z.number().int(),
            limit: z.number().int(),
            total: z.number().int(),
      }),
);

export type Meta = z.infer<typeof metaSchema>;

export const errorEnvelopeSchema = apiSchema(
      'ErrorEnvelope',
      z.object({
            success: z.literal(false),
            error: z.object({
                  code: errorCodeSchema,
                  message: z.string().meta({ description: 'Thông báo tiếng Việt, dùng để hiển thị chứ không để phân nhánh' }),
                  details: z.unknown().optional().meta({ description: 'Dữ liệu máy đọc được kèm theo lỗi, hình dạng tuỳ theo mã lỗi' }),
            }),
      }),
);

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/**
 * Vỏ bọc thành công phụ thuộc kiểu dữ liệu của từng endpoint nên chỉ tồn tại ở
 * dạng kiểu, không có schema tương ứng. Tài liệu OpenAPI dựng nó tại từng đường
 * dẫn từ schema của `data`.
 */
export type SuccessEnvelope<T> = {
      success: true;
      data: T;
      meta?: Meta;
};

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

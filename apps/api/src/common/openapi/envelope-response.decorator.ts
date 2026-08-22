import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse, type SchemaObject } from '@nestjs/swagger';
import { DEFAULT_ERROR_MESSAGES, errorEnvelopeSchema, metaSchema, refTo } from '@shopflow/shared';
import type { z } from 'zod';

import { errorCodeForStatus } from '../errors/status-to-code.js';
import { toResponseSchema } from './zod-schema.js';

type EnvelopeOptions = {
      status?: number;
      description?: string;
      /** `data` là danh sách phần tử. */
      isArray?: boolean;
      /** Endpoint có phân trang: `data` là danh sách và envelope kèm `meta`. */
      paginated?: boolean;
};

/**
 * Mô tả response thành công của một endpoint.
 *
 * Controller chỉ trả dữ liệu thuần còn `EnvelopeInterceptor` bọc lại, nên tài liệu
 * phải tự dựng lớp vỏ đó — nếu không thì hình dạng ghi trong tài liệu thiếu mất
 * đúng lớp mà client thực sự nhận được.
 */
export function ApiEnvelope(schema: z.ZodType, options: EnvelopeOptions = {}): MethodDecorator & ClassDecorator {
      return ApiResponse({
            status: options.status ?? HttpStatus.OK,
            description: options.description,
            schema: successEnvelope(schema, options),
      });
}

/**
 * Mô tả các response lỗi.
 *
 * 429 và 500 gắn sẵn cho mọi endpoint: giới hạn tần suất là guard toàn cục nên
 * đường dẫn nào cũng chạm được, và lỗi ngoài dự kiến thì không đường dẫn nào miễn.
 */
export function ApiErrors(...statuses: number[]): MethodDecorator & ClassDecorator {
      const all = [...new Set([...statuses, HttpStatus.TOO_MANY_REQUESTS, HttpStatus.INTERNAL_SERVER_ERROR])];

      return applyDecorators(...all.map(errorResponse));
}

/**
 * Response lỗi có phần `details` mang hình dạng xác định.
 *
 * Dùng cho những lỗi mà client phải xử lý chứ không chỉ hiển thị — ví dụ đặt hàng
 * hụt tồn kho, nơi giao diện cần biết SKU nào chặn và còn lại bao nhiêu.
 */
export function ApiErrorWithDetails(status: number, details: z.ZodType, description?: string): MethodDecorator & ClassDecorator {
      const code = errorCodeForStatus(status);

      return ApiResponse({
            status,
            description: description ?? `\`${code}\` — ${DEFAULT_ERROR_MESSAGES[code]}`,
            schema: {
                  type: 'object',
                  required: ['success', 'error'],
                  properties: {
                        success: { type: 'boolean', enum: [false] },
                        error: {
                              type: 'object',
                              required: ['code', 'message', 'details'],
                              properties: {
                                    code: { type: 'string', enum: [code] },
                                    message: { type: 'string' },
                                    details: toResponseSchema(details),
                              },
                        },
                  },
            },
      });
}

function errorResponse(status: number): MethodDecorator & ClassDecorator {
      const code = errorCodeForStatus(status);

      return ApiResponse({
            status,
            description: `\`${code}\` — ${DEFAULT_ERROR_MESSAGES[code]}`,
            schema: refTo(errorEnvelopeSchema),
      });
}

function successEnvelope(schema: z.ZodType, options: EnvelopeOptions): SchemaObject {
      const isPaginated = options.paginated === true;
      const data = toResponseSchema(schema);

      return {
            type: 'object',
            required: isPaginated ? ['success', 'data', 'meta'] : ['success', 'data'],
            properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: options.isArray === true || isPaginated ? { type: 'array', items: data } : data,
                  ...(isPaginated ? { meta: refTo(metaSchema) } : {}),
            },
      };
}

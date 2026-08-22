import { orderSummarySchema } from '@shopflow/shared';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { toOpenApiSchema, toQueryProperties, toResponseSchema } from './zod-schema.js';

describe('toOpenApiSchema', () => {
      /**
       * Schema request chuyển chuỗi chữ số thành bigint. Client gửi lên chuỗi, nên
       * tài liệu phải mô tả chuỗi chứ không mô tả kết quả sau biến đổi.
       */
      test('mô tả hình dạng trước biến đổi ở chiều vào', () => {
            const schema = z.object({ price: z.string().regex(/^\d+$/).transform(BigInt) });

            expect(toOpenApiSchema(schema, 'input').properties?.price).toMatchObject({ type: 'string', pattern: '^\\d+$' });
      });

      test('giữ lại giá trị mặc định để tài liệu nêu đúng hành vi khi bỏ trống', () => {
            const schema = z.object({ page: z.coerce.number().int().min(1).default(1) });

            expect(toOpenApiSchema(schema, 'input').properties?.page).toMatchObject({ default: 1 });
      });

      test('đánh dấu trường bắt buộc', () => {
            const schema = z.object({ sku: z.string(), note: z.string().optional() });

            expect(toOpenApiSchema(schema, 'output').required).toEqual(['sku']);
      });

      /** Zod không biểu diễn được phép biến đổi ở chiều ra; đây là chốt chặn của lớp bọc. */
      test('ném lỗi khi mô tả chiều ra của schema có biến đổi', () => {
            const schema = z.object({ price: z.string().transform(BigInt) });

            expect(() => toOpenApiSchema(schema, 'output')).toThrow();
      });
});

describe('toResponseSchema', () => {
      test('trỏ tới components khi schema đã đặt tên', () => {
            expect(toResponseSchema(orderSummarySchema)).toEqual({ $ref: '#/components/schemas/OrderSummary' });
      });

      test('nhúng thẳng định nghĩa khi schema chỉ dùng một chỗ', () => {
            const schema = z.object({ removed: z.literal(true) });

            expect(toResponseSchema(schema)).toMatchObject({ type: 'object' });
      });
});

describe('toQueryProperties', () => {
      test('tách schema thành từng tham số truy vấn rời', () => {
            const schema = z.object({
                  page: z.coerce.number().int().default(1),
                  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
                  search: z.string(),
            });

            expect(toQueryProperties(schema)).toEqual([
                  { name: 'page', required: false, schema: expect.objectContaining({ default: 1 }) },
                  { name: 'status', required: false, schema: expect.objectContaining({ enum: ['DRAFT', 'PUBLISHED'] }) },
                  { name: 'search', required: true, schema: expect.objectContaining({ type: 'string' }) },
            ]);
      });

      test('trả về danh sách rỗng khi schema không có thuộc tính nào', () => {
            expect(toQueryProperties(z.object({}))).toEqual([]);
      });
});

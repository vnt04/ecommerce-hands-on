import 'reflect-metadata';

import { HttpStatus } from '@nestjs/common';
import { DECORATORS } from '@nestjs/swagger';
import { orderConflictDetailSchema, productCardSchema } from '@shopflow/shared';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { ApiEnvelope, ApiErrors, ApiErrorWithDetails } from './envelope-response.decorator.js';
import { ApiZodBody, ApiZodQuery } from './zod-request.decorator.js';

type Metadata = Record<string, unknown>;

/** Áp decorator lên một phương thức rồi đọc lại metadata mà @nestjs/swagger ghi. */
function metadataOf(key: string, decorator: MethodDecorator): Metadata {
      class Probe {
            handler(): void {}
      }

      const descriptor = Object.getOwnPropertyDescriptor(Probe.prototype, 'handler');

      decorator(Probe.prototype, 'handler', descriptor as PropertyDescriptor);

      return (Reflect.getMetadata(key, Probe.prototype.handler) ?? {}) as Metadata;
}

function responsesOf(decorator: MethodDecorator): Metadata {
      return metadataOf(DECORATORS.API_RESPONSE, decorator);
}

describe('ApiEnvelope', () => {
      test('bọc dữ liệu vào vỏ thành công, mặc định mã 200', () => {
            const responses = responsesOf(ApiEnvelope(productCardSchema) as MethodDecorator);

            expect(responses['200']).toMatchObject({
                  schema: {
                        type: 'object',
                        required: ['success', 'data'],
                        properties: {
                              success: { type: 'boolean', enum: [true] },
                              data: { $ref: '#/components/schemas/ProductCard' },
                        },
                  },
            });
      });

      test('nhận mã trạng thái khác cho endpoint tạo mới', () => {
            const responses = responsesOf(ApiEnvelope(productCardSchema, { status: HttpStatus.CREATED }) as MethodDecorator);

            expect(Object.keys(responses)).toContain('201');
      });

      test('bọc thành danh sách khi isArray', () => {
            const responses = responsesOf(ApiEnvelope(productCardSchema, { isArray: true }) as MethodDecorator);

            expect(responses['200']).toMatchObject({
                  schema: { properties: { data: { type: 'array', items: { $ref: '#/components/schemas/ProductCard' } } } },
            });
      });

      /** Endpoint phân trang trả meta ở cấp envelope, không nằm trong data. */
      test('kèm meta và luôn là danh sách khi có phân trang', () => {
            const responses = responsesOf(ApiEnvelope(productCardSchema, { paginated: true }) as MethodDecorator);

            expect(responses['200']).toMatchObject({
                  schema: {
                        required: ['success', 'data', 'meta'],
                        properties: {
                              data: { type: 'array' },
                              meta: { $ref: '#/components/schemas/Meta' },
                        },
                  },
            });
      });
});

describe('ApiErrors', () => {
      /** Giới hạn tần suất là guard toàn cục, nên đường dẫn nào cũng chạm được 429. */
      test('luôn kèm 429 và 500 dù không nêu', () => {
            const responses = responsesOf(ApiErrors() as MethodDecorator);

            expect(Object.keys(responses).sort()).toEqual(['429', '500']);
      });

      test('không nhân đôi mã đã nêu tường minh', () => {
            const responses = responsesOf(ApiErrors(HttpStatus.NOT_FOUND, HttpStatus.INTERNAL_SERVER_ERROR) as MethodDecorator);

            expect(Object.keys(responses).sort()).toEqual(['404', '429', '500']);
      });

      test('mô tả nêu mã lỗi máy đọc được đúng như bộ lọc trả về', () => {
            const responses = responsesOf(ApiErrors(HttpStatus.CONFLICT) as MethodDecorator);

            expect(responses['409']).toMatchObject({
                  description: '`CONFLICT` — Thao tác xung đột với trạng thái hiện tại',
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            });
      });
});

describe('ApiErrorWithDetails', () => {
      test('mô tả hình dạng của details', () => {
            const responses = responsesOf(ApiErrorWithDetails(HttpStatus.CONFLICT, orderConflictDetailSchema) as MethodDecorator);

            expect(responses['409']).toMatchObject({
                  schema: {
                        properties: {
                              error: {
                                    required: ['code', 'message', 'details'],
                                    properties: {
                                          code: { enum: ['CONFLICT'] },
                                          details: { $ref: '#/components/schemas/OrderConflictDetail' },
                                    },
                              },
                        },
                  },
            });
      });

      test('dùng mô tả tự đặt khi được nêu', () => {
            const responses = responsesOf(
                  ApiErrorWithDetails(HttpStatus.CONFLICT, orderConflictDetailSchema, 'Hết tồn kho') as MethodDecorator,
            );

            expect(responses['409']).toMatchObject({ description: 'Hết tồn kho' });
      });
});

describe('ApiZodBody và ApiZodQuery', () => {
      test('mô tả thân yêu cầu từ schema kiểm tra dữ liệu vào', () => {
            const parameters = metadataOf(DECORATORS.API_PARAMETERS, ApiZodBody(z.object({ sku: z.string() })));

            expect(parameters).toMatchObject([{ in: 'body', schema: { properties: { sku: { type: 'string' } } } }]);
      });

      test('tách mỗi thuộc tính thành một tham số truy vấn riêng', () => {
            const schema = z.object({ page: z.coerce.number().int().default(1), search: z.string().optional() });
            const parameters = metadataOf(DECORATORS.API_PARAMETERS, ApiZodQuery(schema) as MethodDecorator);

            expect(parameters).toMatchObject([
                  { name: 'page', in: 'query', required: false },
                  { name: 'search', in: 'query', required: false },
            ]);
      });
});

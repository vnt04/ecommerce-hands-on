import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { adminProductDetailSchema, variantChangeEntrySchema } from './admin-catalog.js';
import { cartViewSchema } from './cart.js';
import { productCardSchema, productDetailSchema } from './catalog.js';
import { errorEnvelopeSchema } from './envelope.js';
import { orderDetailWithHistorySchema, orderHistoryEntrySchema, orderSummarySchema } from './order.js';
import { apiSchema, refTo, toComponentSchemas } from './openapi-registry.js';

describe('toComponentSchemas', () => {
      /**
       * Tài liệu được dựng lúc khởi động, nên một schema không chuyển được sẽ làm
       * chết tiến trình api. Đây là chốt chặn: `.transform()` lọt vào schema response
       * là hỏng, và Zod chỉ báo khi thực sự chuyển đổi.
       */
      test('chuyển được toàn bộ schema đã đăng ký mà không ném lỗi', () => {
            expect(() => toComponentSchemas()).not.toThrow();
      });

      test('gồm mọi schema thuộc hợp đồng response', () => {
            const schemas = toComponentSchemas();

            expect(Object.keys(schemas)).toEqual(
                  expect.arrayContaining([
                        'AdminProductDetail',
                        'CartView',
                        'ErrorEnvelope',
                        'Meta',
                        'OrderDetailWithHistory',
                        'ProductCard',
                        'ProductDetail',
                  ]),
            );
      });

      test('schema dùng chung được tham chiếu bằng $ref thay vì lặp lại định nghĩa', () => {
            const schemas = toComponentSchemas();
            const colors = (schemas.ProductCard as { properties: { colors: { items: unknown } } }).properties.colors;

            expect(colors.items).toEqual({ $ref: '#/components/schemas/ColorSummary' });
      });

      test('không giữ lại $id vì OpenAPI 3.0 không có từ khoá đó', () => {
            const schemas = toComponentSchemas();

            expect(Object.values(schemas).every((schema) => !('$id' in schema))).toBe(true);
      });

      /** Ràng buộc R1 và ADR-003: tiền đi qua JSON dưới dạng chuỗi, không phải number. */
      test('mô tả trường tiền là chuỗi chữ số', () => {
            const schemas = toComponentSchemas();
            const total = (schemas.OrderSummary as { properties: { total: Record<string, unknown> } }).properties.total;

            expect(total).toMatchObject({ type: 'string', pattern: '^-?\\d+$' });
      });
});

describe('refTo', () => {
      test('trả về đường dẫn tham chiếu của schema đã đặt tên', () => {
            expect(refTo(orderSummarySchema)).toEqual({ $ref: '#/components/schemas/OrderSummary' });
      });

      test('ném lỗi khi schema chưa được đặt tên', () => {
            expect(() => refTo(z.object({ sku: z.string() }))).toThrow(/chưa được đặt tên/);
      });

      test('nhận diện được schema vừa đặt tên', () => {
            const schema = apiSchema('ProbeOnly', z.object({ value: z.string() }));

            expect(refTo(schema)).toEqual({ $ref: '#/components/schemas/ProbeOnly' });
      });
});

describe('hợp đồng response', () => {
      test('chấp nhận một đơn hàng đủ trường kèm lịch sử', () => {
            const order = {
                  orderNumber: 'SF-20260822-0001',
                  status: 'CONFIRMED',
                  paymentMethod: 'COD',
                  paymentStatus: 'UNPAID',
                  placedAt: '2026-08-22T02:30:00.000Z',
                  itemCount: 2,
                  total: '598000',
                  subtotal: '598000',
                  shippingFee: '0',
                  lines: [
                        {
                              sku: 'SF-TEE-BLK-L',
                              productName: 'Áo thun trơn',
                              productSlug: 'ao-thun-tron',
                              colorName: 'Đen',
                              sizeName: 'L',
                              quantity: 2,
                              unitPrice: '299000',
                              lineTotal: '598000',
                        },
                  ],
                  shipping: {
                        recipientName: 'Nguyễn Văn A',
                        recipientPhone: '0912345678',
                        addressLine: '12 Lê Lợi',
                        ward: 'Bến Nghé',
                        district: 'Quận 1',
                        province: 'TP Hồ Chí Minh',
                  },
                  history: [{ at: '2026-08-22T02:30:00.000Z', changedBy: null, note: null, kind: 'STATUS', from: null, to: 'PENDING' }],
                  allowedTransitions: ['SHIPPING', 'CANCELLED'],
            };

            expect(orderDetailWithHistorySchema.safeParse(order).success).toBe(true);
      });

      /** Hai nhánh lịch sử mang trường khác nhau; trộn lẫn nghĩa là dòng lịch sử vô nghĩa. */
      test('từ chối dòng lịch sử trộn trường của hai nhánh', () => {
            const mixed = { at: '2026-08-22T02:30:00.000Z', changedBy: null, note: null, kind: 'PAYMENT', from: null, to: 'SHIPPING' };

            expect(orderHistoryEntrySchema.safeParse(mixed).success).toBe(false);
      });

      test('từ chối lịch sử biến thể thiếu trường của nhánh STOCK', () => {
            const missingStockAfter = { at: '2026-08-22T02:30:00.000Z', changedBy: null, reason: null, kind: 'STOCK', delta: 5 };

            expect(variantChangeEntrySchema.safeParse(missingStockAfter).success).toBe(false);
      });

      test('từ chối số tiền dạng number', () => {
            const cart = { lines: [], subtotal: 0, itemCount: 0 };

            expect(cartViewSchema.safeParse(cart).success).toBe(false);
      });

      test('cho phép sizeChart rỗng', () => {
            const product = {
                  slug: 'ao-thun-tron',
                  name: 'Áo thun trơn',
                  description: null,
                  material: null,
                  careGuide: null,
                  printMethod: null,
                  colors: [],
                  sizes: [],
                  variants: [],
                  sizeChart: null,
            };

            expect(productDetailSchema.safeParse(product).success).toBe(true);
      });

      test('vỏ bọc lỗi không bắt buộc có details', () => {
            const envelope = { success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } };

            expect(errorEnvelopeSchema.safeParse(envelope).success).toBe(true);
      });

      test('từ chối mã lỗi ngoài danh mục', () => {
            const envelope = { success: false, error: { code: 'TEAPOT', message: 'Không có mã này' } };

            expect(errorEnvelopeSchema.safeParse(envelope).success).toBe(false);
      });

      test('từ chối thiết kế thiếu trạng thái', () => {
            const product = { slug: 'ao-thun-tron', designCode: 'TEE-01', name: 'Áo thun trơn' };

            expect(adminProductDetailSchema.safeParse(product).success).toBe(false);
      });

      test('chấp nhận thẻ sản phẩm đủ trường', () => {
            const card = {
                  slug: 'ao-thun-tron',
                  name: 'Áo thun trơn',
                  minPrice: '299000',
                  colors: [{ code: 'BLK', name: 'Đen', hexCode: '#000000' }],
                  inStock: true,
            };

            expect(productCardSchema.safeParse(card).success).toBe(true);
      });
});

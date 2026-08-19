import { describe, expect, test } from 'vitest';

import { DuplicateVariantAxisError, EmptyVariantMatrixError } from './catalog.errors.js';
import { buildVariantMatrix } from './variant-matrix.js';

const COLORS = [
      { id: 1n, code: 'BLK' },
      { id: 2n, code: 'WHT' },
      { id: 3n, code: 'NVY' },
];

const SIZES = [
      { id: 1n, name: 'S' },
      { id: 2n, name: 'M' },
      { id: 3n, name: 'L' },
      { id: 4n, name: 'XL' },
      { id: 5n, name: '2XL' },
];

describe('buildVariantMatrix', () => {
      test('ba màu nhân năm size cho đúng mười lăm tổ hợp', () => {
            expect(buildVariantMatrix({ designCode: 'TEE-SUNSET', colors: COLORS, sizes: SIZES })).toHaveLength(15);
      });

      test('không sinh tổ hợp trùng nhau', () => {
            const matrix = buildVariantMatrix({ designCode: 'TEE-SUNSET', colors: COLORS, sizes: SIZES });
            const skus = new Set(matrix.map((combination) => combination.sku));

            expect(skus.size).toBe(matrix.length);
      });

      test('phủ đúng tích Descartes của hai tập', () => {
            const matrix = buildVariantMatrix({
                  designCode: 'TEE',
                  colors: [{ id: 1n, code: 'BLK' }],
                  sizes: [
                        { id: 1n, name: 'S' },
                        { id: 2n, name: 'M' },
                  ],
            });

            expect(matrix).toEqual([
                  { colorId: 1n, sizeId: 1n, sku: 'TEE-BLK-S' },
                  { colorId: 1n, sizeId: 2n, sku: 'TEE-BLK-M' },
            ]);
      });

      test('giữ nguyên thứ tự đầu vào, không tự sắp xếp lại', () => {
            // Thứ tự size nằm trong database vì suy từ tên sẽ cho 2XL, L, M, S, XL.
            const matrix = buildVariantMatrix({
                  designCode: 'TEE',
                  colors: [{ id: 1n, code: 'BLK' }],
                  sizes: SIZES,
            });

            expect(matrix.map((combination) => combination.sku)).toEqual([
                  'TEE-BLK-S',
                  'TEE-BLK-M',
                  'TEE-BLK-L',
                  'TEE-BLK-XL',
                  'TEE-BLK-2XL',
            ]);
      });

      test('từ chối khi tập màu rỗng', () => {
            expect(() => buildVariantMatrix({ designCode: 'TEE', colors: [], sizes: SIZES })).toThrow(EmptyVariantMatrixError);
      });

      test('từ chối khi tập size rỗng', () => {
            expect(() => buildVariantMatrix({ designCode: 'TEE', colors: COLORS, sizes: [] })).toThrow(EmptyVariantMatrixError);
      });

      test('từ chối khi tập màu có giá trị trùng', () => {
            // Không chặn thì ma trận sinh ra hai SKU giống hệt nhau và chèn vào
            // database sẽ hỏng ở giữa chừng transaction.
            expect(() =>
                  buildVariantMatrix({
                        designCode: 'TEE',
                        colors: [
                              { id: 1n, code: 'BLK' },
                              { id: 2n, code: 'BLK' },
                        ],
                        sizes: SIZES,
                  }),
            ).toThrow(DuplicateVariantAxisError);
      });
});

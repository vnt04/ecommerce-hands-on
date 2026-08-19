import { DuplicateVariantAxisError, EmptyVariantMatrixError } from './catalog.errors.js';
import { generateSku } from './sku.js';

export type ColorAxis = { id: bigint; code: string };
export type SizeAxis = { id: bigint; name: string };

export type VariantCombination = {
      colorId: bigint;
      sizeId: bigint;
      sku: string;
};

function assertNoDuplicate(values: readonly string[], axis: 'màu' | 'size'): void {
      const seen = new Set<string>();

      for (const value of values) {
            if (seen.has(value)) {
                  throw new DuplicateVariantAxisError(axis, value);
            }

            seen.add(value);
      }
}

/**
 * Sinh toàn bộ tổ hợp màu × size cho một thiết kế.
 *
 * Sinh sẵn cả ma trận rồi để admin tắt tổ hợp không sản xuất, thay vì bắt admin
 * tạo tay từng SKU: ba màu năm size đã là mười lăm dòng, nhập tay là mời gọi sai sót.
 *
 * Thứ tự đầu ra theo đúng thứ tự đầu vào. Sắp xếp size theo sortOrder là việc của
 * bên gọi, vì thứ tự đó nằm trong database chứ không suy ra được từ tên.
 */
export function buildVariantMatrix(input: {
      designCode: string;
      colors: readonly ColorAxis[];
      sizes: readonly SizeAxis[];
}): VariantCombination[] {
      const { designCode, colors, sizes } = input;

      if (colors.length === 0) {
            throw new EmptyVariantMatrixError('màu');
      }

      if (sizes.length === 0) {
            throw new EmptyVariantMatrixError('size');
      }

      assertNoDuplicate(
            colors.map((color) => color.code),
            'màu',
      );
      assertNoDuplicate(
            sizes.map((size) => size.name),
            'size',
      );

      return colors.flatMap((color) =>
            sizes.map((size) => ({
                  colorId: color.id,
                  sizeId: size.id,
                  sku: generateSku({ designCode, colorCode: color.code, sizeName: size.name }),
            })),
      );
}

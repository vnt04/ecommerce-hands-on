/**
 * Hợp đồng dữ liệu của API catalog công khai.
 *
 * Định nghĩa một lần ở đây rồi cả api lẫn web cùng dùng: đổi hình dạng dữ liệu mà
 * quên sửa một phía thì typecheck đỏ ngay, thay vì để lỗi lộ ra lúc chạy.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003. Chuyển sang
 * bigint bằng `vndFromJson` hoặc định dạng thẳng bằng `formatVndFromJson`.
 */

import { z } from 'zod';

import { vndJson } from './money.js';
import { apiSchema } from './openapi-registry.js';

export const colorSummarySchema = apiSchema(
      'ColorSummary',
      z.object({
            code: z.string().meta({ example: 'BLK' }),
            name: z.string(),
            hexCode: z.string().meta({ example: '#000000' }),
      }),
);

export type ColorSummary = z.infer<typeof colorSummarySchema>;

export const sizeSummarySchema = apiSchema(
      'SizeSummary',
      z.object({
            name: z.string().meta({ example: 'L' }),
            sortOrder: z.number().int(),
      }),
);

export type SizeSummary = z.infer<typeof sizeSummarySchema>;

export const productImageSummarySchema = apiSchema(
      'ProductImageSummary',
      z.object({
            url: z.string(),
            altText: z.string().nullable(),
      }),
);

export type ProductImageSummary = z.infer<typeof productImageSummarySchema>;

export const productCardSchema = apiSchema(
      'ProductCard',
      z.object({
            slug: z.string(),
            name: z.string(),
            minPrice: vndJson,
            colors: z.array(colorSummarySchema),
            inStock: z.boolean(),
      }),
);

export type ProductCard = z.infer<typeof productCardSchema>;

export const productVariantSummarySchema = apiSchema(
      'ProductVariantSummary',
      z.object({
            sku: z.string(),
            colorCode: z.string(),
            sizeName: z.string(),
            price: vndJson,
            inStock: z.boolean().meta({
                  description:
                        'Biến thể hết hàng vẫn nằm trong danh sách. Giao diện cần biết size nào tồn tại mà không mua được, ' +
                        'để hiển thị vô hiệu hoá thay vì ẩn đi (ràng buộc R9)',
            }),
      }),
);

export type ProductVariantSummary = z.infer<typeof productVariantSummarySchema>;

const productDetailColorSchema = apiSchema('ProductDetailColor', colorSummarySchema.extend({ images: z.array(productImageSummarySchema) }));

export const productDetailSchema = apiSchema(
      'ProductDetail',
      z.object({
            slug: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            material: z.string().nullable(),
            careGuide: z.string().nullable(),
            printMethod: z.string().nullable(),
            colors: z.array(productDetailColorSchema),
            sizes: z.array(sizeSummarySchema),
            variants: z.array(productVariantSummarySchema),
            sizeChart: z.object({ name: z.string(), measurements: z.unknown() }).nullable(),
      }),
);

export type ProductDetail = z.infer<typeof productDetailSchema>;

/** Tập giá trị có thể lọc. Trang danh sách cần biết trước để dựng bộ lọc. */
export const catalogFilterOptionsSchema = apiSchema(
      'CatalogFilterOptions',
      z.object({
            colors: z.array(colorSummarySchema),
            sizes: z.array(sizeSummarySchema),
      }),
);

export type CatalogFilterOptions = z.infer<typeof catalogFilterOptionsSchema>;

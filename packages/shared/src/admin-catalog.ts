/**
 * Hợp đồng dữ liệu của API quản trị sản phẩm.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003.
 */

import { z } from 'zod';

import { vndJson } from './money.js';
import { apiSchema } from './openapi-registry.js';

export const productStatusSchema = apiSchema('ProductStatus', z.enum(['DRAFT', 'PUBLISHED']));

export type ProductStatus = z.infer<typeof productStatusSchema>;

/** Hàng trong danh sách thiết kế: đủ để biết cái nào cần xử lý mà không phải mở ra. */
export const adminProductSummarySchema = apiSchema(
      'AdminProductSummary',
      z.object({
            slug: z.string(),
            designCode: z.string(),
            name: z.string(),
            status: productStatusSchema,
            isArchived: z.boolean(),
            variantCount: z.number().int(),
            activeVariantCount: z.number().int(),
            totalStock: z.number().int().meta({ description: 'Tổng tồn của cả thiết kế, để nhìn danh sách là biết cái nào sắp hết' }),
      }),
);

export type AdminProductSummary = z.infer<typeof adminProductSummarySchema>;

export const adminVariantSchema = apiSchema(
      'AdminVariant',
      z.object({
            sku: z.string(),
            colorCode: z.string(),
            colorName: z.string(),
            colorHex: z.string(),
            sizeName: z.string(),
            price: vndJson,
            stockQuantity: z.number().int(),
            isActive: z.boolean(),
      }),
);

export type AdminVariant = z.infer<typeof adminVariantSchema>;

export const adminProductImageSchema = apiSchema(
      'AdminProductImage',
      z.object({
            id: z.string(),
            url: z.string(),
            altText: z.string().nullable(),
            colorCode: z.string().nullable().meta({ description: 'Ảnh gắn với một màu cụ thể, hoặc rỗng nếu dùng chung cho cả thiết kế' }),
      }),
);

export type AdminProductImage = z.infer<typeof adminProductImageSchema>;

export const adminProductDetailSchema = apiSchema(
      'AdminProductDetail',
      z.object({
            slug: z.string(),
            designCode: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            material: z.string().nullable(),
            careGuide: z.string().nullable(),
            printMethod: z.string().nullable(),
            status: productStatusSchema,
            isArchived: z.boolean(),
            categoryName: z.string(),
            variants: z.array(adminVariantSchema),
            images: z.array(adminProductImageSchema),
      }),
);

export type AdminProductDetail = z.infer<typeof adminProductDetailSchema>;

/** Một dòng lịch sử của biến thể: đúng một thay đổi, hoặc giá, hoặc tồn kho. */
export const variantChangeEntrySchema = apiSchema(
      'VariantChangeEntry',
      z.intersection(
            z.object({
                  at: z.iso.datetime(),
                  changedBy: z.string().nullable().meta({ description: 'Tên người thực hiện. Rỗng nghĩa là do hệ thống' }),
                  reason: z.string().nullable(),
            }),
            z.discriminatedUnion('kind', [
                  z.object({ kind: z.literal('PRICE'), from: vndJson, to: vndJson }),
                  z.object({ kind: z.literal('STOCK'), delta: z.number().int(), stockAfter: z.number().int() }),
            ]),
      ),
);

export type VariantChangeEntry = z.infer<typeof variantChangeEntrySchema>;

/** Trục dùng để dựng ma trận: danh sách màu và size có sẵn trong hệ thống. */
export const catalogAxesSchema = apiSchema(
      'CatalogAxes',
      z.object({
            categories: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
            colors: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), hexCode: z.string() })),
            sizes: z.array(z.object({ id: z.string(), name: z.string(), sortOrder: z.number().int() })),
      }),
);

export type CatalogAxes = z.infer<typeof catalogAxesSchema>;

import { z } from 'zod';

const MAX_NAME_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;
const MAX_SEARCH_LENGTH = 100;
const MAX_REASON_LENGTH = 200;

/** Trần một lần điều chỉnh tồn kho. Số lớn hơn gần như luôn là gõ nhầm. */
const MAX_STOCK_DELTA = 10_000;

const productStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);

/** Mã thiết kế và slug là định danh, nên hạn chế ký tự ngay ở biên. */
const designCodeSchema = z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, 'Mã thiết kế chỉ gồm chữ in hoa, số và dấu gạch ngang');

const slugSchema = z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{2,79}$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang');

/** Tiền là số nguyên, đơn vị đồng (ràng buộc R1). Nhận chuỗi chữ số theo ADR-003. */
const vndSchema = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform((value) => BigInt(value));

/** Định danh gửi từ client là chuỗi chữ số; chuyển sang bigint ở biên. */
const idSchema = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform((value) => BigInt(value));

export const createProductSchema = z.object({
      categoryId: idSchema,
      designCode: designCodeSchema,
      slug: slugSchema,
      name: z.string().trim().min(2).max(MAX_NAME_LENGTH),
      description: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
      material: z.string().trim().max(MAX_NAME_LENGTH).optional(),
      careGuide: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
      printMethod: z.string().trim().max(MAX_NAME_LENGTH).optional(),
      colorIds: z.array(idSchema).min(1, 'Chọn ít nhất một màu'),
      sizeIds: z.array(idSchema).min(1, 'Chọn ít nhất một size'),
      defaultPrice: vndSchema,
      defaultStockQuantity: z.coerce.number().int().min(0).max(MAX_STOCK_DELTA).default(0),
});

export type CreateProductBody = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
      .object({
            name: z.string().trim().min(2).max(MAX_NAME_LENGTH).optional(),
            description: z.string().trim().max(MAX_TEXT_LENGTH).nullable().optional(),
            material: z.string().trim().max(MAX_NAME_LENGTH).nullable().optional(),
            careGuide: z.string().trim().max(MAX_TEXT_LENGTH).nullable().optional(),
            printMethod: z.string().trim().max(MAX_NAME_LENGTH).nullable().optional(),
            status: productStatusSchema.optional(),
            archived: z.boolean().optional(),
      })
      .refine((value) => Object.keys(value).length > 0, 'Không có gì để cập nhật');

export type UpdateProductBody = z.infer<typeof updateProductSchema>;

export const extendMatrixSchema = z
      .object({
            colorIds: z.array(idSchema).default([]),
            sizeIds: z.array(idSchema).default([]),
            defaultPrice: vndSchema,
      })
      .refine((value) => value.colorIds.length > 0 || value.sizeIds.length > 0, 'Nêu ít nhất một màu hoặc một size để thêm');

export type ExtendMatrixBody = z.infer<typeof extendMatrixSchema>;

export const updateVariantSchema = z
      .object({
            price: vndSchema.optional(),
            isActive: z.boolean().optional(),
            reason: z.string().trim().max(MAX_REASON_LENGTH).optional(),
      })
      .refine((value) => value.price !== undefined || value.isActive !== undefined, 'Không có gì để cập nhật');

export type UpdateVariantBody = z.infer<typeof updateVariantSchema>;

/**
 * Nhập tồn theo lượng cộng thêm, không theo số cuối.
 *
 * Số âm là điều chỉnh giảm. Từ chối số 0 vì một dòng lịch sử không đổi gì thì
 * không nói lên điều gì.
 */
export const adjustStockSchema = z.object({
      delta: z.coerce
            .number()
            .int()
            .min(-MAX_STOCK_DELTA)
            .max(MAX_STOCK_DELTA)
            .refine((value) => value !== 0, 'Lượng điều chỉnh phải khác 0'),
      reason: z.string().trim().max(MAX_REASON_LENGTH).optional(),
});

export type AdjustStockBody = z.infer<typeof adjustStockSchema>;

export const adminProductQuerySchema = z.object({
      status: productStatusSchema.optional(),
      includeArchived: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
      search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
      page: z.coerce.number().int().min(1).default(1),
});

export type AdminProductQueryInput = z.infer<typeof adminProductQuerySchema>;

export const uploadImageSchema = z.object({
      productSlug: slugSchema,
      colorCode: z.string().trim().max(16).optional(),
      altText: z.string().trim().max(MAX_NAME_LENGTH).optional(),
});

export type UploadImageBody = z.infer<typeof uploadImageSchema>;

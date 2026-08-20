import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
      vndToJson,
      type AdminProductDetail,
      type AdminProductSummary,
      type ProductStatus,
      type VariantChangeEntry,
} from '@shopflow/shared';

import { DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildVariantMatrix } from './domain/variant-matrix.js';

export const ADMIN_PRODUCTS_PAGE_SIZE = 20;

export type AdminProductQuery = {
      status?: ProductStatus;
      includeArchived: boolean;
      search?: string;
      page: number;
};

export type UpdateProductInput = {
      name?: string;
      description?: string | null;
      material?: string | null;
      careGuide?: string | null;
      printMethod?: string | null;
      status?: ProductStatus;
      /** `true` để lưu trữ, `false` để bỏ lưu trữ. Không xoá cứng (ràng buộc R8). */
      archived?: boolean;
};

export type UpdateVariantInput = {
      price?: bigint;
      isActive?: boolean;
      reason?: string;
};

@Injectable()
export class ProductAdminService {
      constructor(private readonly prisma: PrismaService) {}

      async list(query: AdminProductQuery): Promise<{ items: AdminProductSummary[]; total: number }> {
            const where: Prisma.ProductWhereInput = {};

            if (query.status !== undefined) {
                  where.status = query.status;
            }

            // Bản đã lưu trữ mặc định không hiện: nó là thứ đã ngừng bán, và để lẫn
            // vào danh sách hằng ngày chỉ làm nhiễu.
            if (!query.includeArchived) {
                  where.archivedAt = null;
            }

            if (query.search !== undefined && query.search !== '') {
                  where.OR = [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { designCode: { contains: query.search, mode: 'insensitive' } },
                        { slug: { contains: query.search, mode: 'insensitive' } },
                  ];
            }

            const [total, products] = await Promise.all([
                  this.prisma.product.count({ where }),
                  this.prisma.product.findMany({
                        where,
                        orderBy: { id: 'desc' },
                        skip: (query.page - 1) * ADMIN_PRODUCTS_PAGE_SIZE,
                        take: ADMIN_PRODUCTS_PAGE_SIZE,
                        select: {
                              slug: true,
                              designCode: true,
                              name: true,
                              status: true,
                              archivedAt: true,
                              variants: { select: { isActive: true, stockQuantity: true } },
                        },
                  }),
            ]);

            return {
                  total,
                  items: products.map((product) => ({
                        slug: product.slug,
                        designCode: product.designCode,
                        name: product.name,
                        status: product.status,
                        isArchived: product.archivedAt !== null,
                        variantCount: product.variants.length,
                        activeVariantCount: product.variants.filter((variant) => variant.isActive).length,
                        // Tổng tồn của cả thiết kế, để nhìn danh sách là biết cái nào sắp hết.
                        totalStock: product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
                  })),
            };
      }

      async detail(slug: string): Promise<AdminProductDetail> {
            const product = await this.prisma.product.findUnique({
                  where: { slug },
                  select: {
                        slug: true,
                        designCode: true,
                        name: true,
                        description: true,
                        material: true,
                        careGuide: true,
                        printMethod: true,
                        status: true,
                        archivedAt: true,
                        category: { select: { slug: true, name: true } },
                        variants: {
                              orderBy: [{ color: { code: 'asc' } }, { size: { sortOrder: 'asc' } }],
                              select: {
                                    sku: true,
                                    price: true,
                                    stockQuantity: true,
                                    isActive: true,
                                    color: { select: { code: true, name: true, hexCode: true } },
                                    size: { select: { name: true } },
                              },
                        },
                        images: {
                              orderBy: { sortOrder: 'asc' },
                              select: { id: true, url: true, altText: true, color: { select: { code: true } } },
                        },
                  },
            });

            if (product === null) {
                  throw new NotFoundException('Không tìm thấy thiết kế');
            }

            return {
                  slug: product.slug,
                  designCode: product.designCode,
                  name: product.name,
                  description: product.description,
                  material: product.material,
                  careGuide: product.careGuide,
                  printMethod: product.printMethod,
                  status: product.status,
                  isArchived: product.archivedAt !== null,
                  categoryName: product.category.name,
                  variants: product.variants.map((variant) => ({
                        sku: variant.sku,
                        colorCode: variant.color.code,
                        colorName: variant.color.name,
                        colorHex: variant.color.hexCode,
                        sizeName: variant.size.name,
                        price: vndToJson(variant.price),
                        stockQuantity: variant.stockQuantity,
                        isActive: variant.isActive,
                  })),
                  images: product.images.map((image) => ({
                        id: image.id.toString(),
                        url: image.url,
                        altText: image.altText,
                        colorCode: image.color?.code ?? null,
                  })),
            };
      }

      async update(slug: string, input: UpdateProductInput): Promise<AdminProductDetail> {
            const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });

            if (product === null) {
                  throw new NotFoundException('Không tìm thấy thiết kế');
            }

            await this.prisma.product.update({
                  where: { id: product.id },
                  data: {
                        name: input.name,
                        description: input.description,
                        material: input.material,
                        careGuide: input.careGuide,
                        printMethod: input.printMethod,
                        status: input.status,
                        // Lưu trữ là đánh dấu thời điểm, không phải xoá (ràng buộc R8).
                        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
                  },
            });

            return this.detail(slug);
      }

      /**
       * Thêm màu hoặc size vào ma trận của một thiết kế đã có.
       *
       * Chỉ sinh những tổ hợp còn thiếu. Sinh lại cả ma trận thì SKU đã có sẽ va
       * vào ràng buộc duy nhất, và tệ hơn là nếu có ai đó dùng `upsert` thì biến
       * thể cũ bị ghi đè giá và tồn — trong khi nó đang nằm trong đơn hàng.
       */
      async extendMatrix(
            slug: string,
            colorIds: readonly bigint[],
            sizeIds: readonly bigint[],
            defaultPrice: bigint,
      ): Promise<AdminProductDetail> {
            const product = await this.prisma.product.findUnique({
                  where: { slug },
                  select: {
                        id: true,
                        designCode: true,
                        variants: { select: { colorId: true, sizeId: true } },
                  },
            });

            if (product === null) {
                  throw new NotFoundException('Không tìm thấy thiết kế');
            }

            // Trục mới hợp với trục đang có: thêm một màu nghĩa là màu đó nhân với mọi
            // size hiện có, không phải chỉ nhân với size vừa thêm.
            const existingColorIds = [...new Set(product.variants.map((variant) => variant.colorId))];
            const existingSizeIds = [...new Set(product.variants.map((variant) => variant.sizeId))];

            const allColorIds = [...new Set([...existingColorIds, ...colorIds])];
            const allSizeIds = [...new Set([...existingSizeIds, ...sizeIds])];

            const [colors, sizes] = await Promise.all([
                  this.prisma.color.findMany({ where: { id: { in: allColorIds } }, select: { id: true, code: true } }),
                  this.prisma.size.findMany({
                        where: { id: { in: allSizeIds } },
                        orderBy: { sortOrder: 'asc' },
                        select: { id: true, name: true },
                  }),
            ]);

            const existing = new Set(product.variants.map((variant) => variant.colorId + ':' + variant.sizeId));

            const missing = buildVariantMatrix({ designCode: product.designCode, colors, sizes }).filter(
                  (combination) => !existing.has(combination.colorId + ':' + combination.sizeId),
            );

            if (missing.length === 0) {
                  throw new DomainException(HttpStatus.CONFLICT, 'Ma trận đã đầy đủ, không có tổ hợp nào để thêm', {
                        reason: 'MATRIX_COMPLETE',
                  });
            }

            await this.prisma.productVariant.createMany({
                  data: missing.map((combination) => ({
                        productId: product.id,
                        colorId: combination.colorId,
                        sizeId: combination.sizeId,
                        sku: combination.sku,
                        price: defaultPrice,
                        stockQuantity: 0,
                  })),
            });

            return this.detail(slug);
      }

      /**
       * Đổi giá hoặc bật tắt một tổ hợp, có ghi lịch sử khi giá thay đổi.
       *
       * Đổi giá không chạm vào đơn đã đặt: S08 đã chép giá vào dòng đơn, và không
       * có chỗ nào đọc ngược giá từ catalog cho một đơn cũ (ràng buộc R4).
       */
      async updateVariant(sku: string, input: UpdateVariantInput, actorId: bigint): Promise<void> {
            await this.prisma.$transaction(async (tx) => {
                  const variant = await tx.productVariant.findUnique({ where: { sku }, select: { id: true, price: true } });

                  if (variant === null) {
                        throw new NotFoundException('Không tìm thấy tổ hợp ' + sku);
                  }

                  await tx.productVariant.update({
                        where: { id: variant.id },
                        data: { price: input.price, isActive: input.isActive },
                  });

                  if (input.price !== undefined && input.price !== variant.price) {
                        await tx.variantChange.create({
                              data: {
                                    variantId: variant.id,
                                    priceFrom: variant.price,
                                    priceTo: input.price,
                                    reason: input.reason,
                                    changedById: actorId,
                              },
                        });
                  }
            });
      }

      /**
       * Nhập hoặc điều chỉnh tồn kho theo lượng cộng thêm.
       *
       * Cộng thêm chứ không đặt giá trị tuyệt đối. Người bán đọc thấy kho còn 5 rồi
       * gõ 15 để nhập thêm 10; giữa hai thao tác đó có ba đơn được đặt, và con số 15
       * xoá mất ba lần trừ tồn vừa xảy ra. Cộng thêm thì không có khe hở nào.
       *
       * Điều chỉnh giảm gửi số âm. Ràng buộc `CHECK stock_quantity >= 0` chặn việc
       * trừ quá tay, và ở đây ta bắt lỗi đó để trả về câu trả lời có nghĩa.
       */
      async adjustStock(sku: string, delta: number, actorId: bigint, reason?: string): Promise<{ stockAfter: number }> {
            return this.prisma.$transaction(async (tx) => {
                  const variant = await tx.productVariant.findUnique({ where: { sku }, select: { id: true, stockQuantity: true } });

                  if (variant === null) {
                        throw new NotFoundException('Không tìm thấy tổ hợp ' + sku);
                  }

                  if (delta < 0 && variant.stockQuantity + delta < 0) {
                        throw new DomainException(
                              HttpStatus.CONFLICT,
                              'Kho chỉ còn ' + variant.stockQuantity + ' sản phẩm, không giảm được ' + Math.abs(delta),
                              { reason: 'INSUFFICIENT_STOCK', sku, availableQuantity: variant.stockQuantity },
                        );
                  }

                  const updated = await tx.productVariant.update({
                        where: { id: variant.id },
                        data: { stockQuantity: { increment: delta } },
                        select: { stockQuantity: true },
                  });

                  await tx.variantChange.create({
                        data: {
                              variantId: variant.id,
                              stockDelta: delta,
                              stockAfter: updated.stockQuantity,
                              reason,
                              changedById: actorId,
                        },
                  });

                  return { stockAfter: updated.stockQuantity };
            });
      }

      async historyOf(sku: string): Promise<VariantChangeEntry[]> {
            const rows = await this.prisma.variantChange.findMany({
                  where: { variant: { sku } },
                  orderBy: { createdAt: 'desc' },
                  select: {
                        createdAt: true,
                        priceFrom: true,
                        priceTo: true,
                        stockDelta: true,
                        stockAfter: true,
                        reason: true,
                        changedBy: { select: { fullName: true } },
                  },
            });

            return rows.map((row): VariantChangeEntry => {
                  const common = {
                        at: row.createdAt.toISOString(),
                        changedBy: row.changedBy?.fullName ?? null,
                        reason: row.reason,
                  };

                  // Ràng buộc CHECK bảo đảm đúng một trong hai loại có giá trị.
                  return row.priceTo === null
                        ? { ...common, kind: 'STOCK', delta: row.stockDelta as number, stockAfter: row.stockAfter as number }
                        : { ...common, kind: 'PRICE', from: vndToJson(row.priceFrom as bigint), to: vndToJson(row.priceTo) };
            });
      }
}

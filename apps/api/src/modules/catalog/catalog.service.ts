import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { buildVariantMatrix } from './domain/variant-matrix.js';

export type CreateProductInput = {
      categoryId: bigint;
      designCode: string;
      slug: string;
      name: string;
      description?: string;
      material?: string;
      careGuide?: string;
      printMethod?: string;
      sizeChartId?: bigint;
      colorIds: readonly bigint[];
      sizeIds: readonly bigint[];
      /// Giá áp cho mọi biến thể lúc tạo. Điều chỉnh riêng từng SKU bằng updateVariantPricing.
      defaultPrice: bigint;
      defaultStockQuantity?: number;
      defaultWeightGrams?: number;
};

export type VariantPricingUpdate = {
      sku: string;
      price?: bigint;
      stockQuantity?: number;
};

@Injectable()
export class CatalogService {
      constructor(private readonly prisma: PrismaService) {}

      /**
       * Tạo một thiết kế cùng toàn bộ ma trận biến thể trong một transaction.
       *
       * Phải là một transaction: sản phẩm tồn tại mà không có biến thể nào sẽ hiện ra
       * trên trang danh sách nhưng không mua được, và lỗi kiểu đó rất khó phát hiện vì
       * không có gì báo động.
       */
      async createProductWithMatrix(input: CreateProductInput): Promise<{ productId: bigint; variantCount: number }> {
            const [colors, sizes] = await Promise.all([
                  this.prisma.color.findMany({
                        where: { id: { in: [...input.colorIds] } },
                        select: { id: true, code: true },
                  }),
                  this.prisma.size.findMany({
                        where: { id: { in: [...input.sizeIds] } },
                        // Thứ tự hiển thị nằm trong database vì suy từ tên sẽ cho 2XL, L, M, S, XL.
                        orderBy: { sortOrder: 'asc' },
                        select: { id: true, name: true },
                  }),
            ]);

            const matrix = buildVariantMatrix({ designCode: input.designCode, colors, sizes });

            return this.prisma.$transaction(async (tx) => {
                  const product = await tx.product.create({
                        data: {
                              categoryId: input.categoryId,
                              designCode: input.designCode,
                              slug: input.slug,
                              name: input.name,
                              description: input.description,
                              material: input.material,
                              careGuide: input.careGuide,
                              printMethod: input.printMethod,
                              sizeChartId: input.sizeChartId,
                        },
                        select: { id: true },
                  });

                  const created = await tx.productVariant.createMany({
                        data: matrix.map((combination) => ({
                              productId: product.id,
                              colorId: combination.colorId,
                              sizeId: combination.sizeId,
                              sku: combination.sku,
                              price: input.defaultPrice,
                              stockQuantity: input.defaultStockQuantity ?? 0,
                              weightGrams: input.defaultWeightGrams ?? 0,
                        })),
                  });

                  return { productId: product.id, variantCount: created.count };
            });
      }

      /** Tắt những tổ hợp không sản xuất. Tắt thay vì xoá để ma trận vẫn đầy đủ. */
      async setVariantsActive(skus: readonly string[], isActive: boolean): Promise<number> {
            const result = await this.prisma.productVariant.updateMany({
                  where: { sku: { in: [...skus] } },
                  data: { isActive },
            });

            return result.count;
      }

      /** Cập nhật giá và tồn theo lô, mỗi SKU một dòng. */
      async updateVariantPricing(updates: readonly VariantPricingUpdate[]): Promise<number> {
            return this.prisma.$transaction(async (tx) => {
                  let updated = 0;

                  for (const update of updates) {
                        const result = await tx.productVariant.updateMany({
                              where: { sku: update.sku },
                              data: { price: update.price, stockQuantity: update.stockQuantity },
                        });

                        updated += result.count;
                  }

                  return updated;
            });
      }

      /** Biến thể đang bán được của một thiết kế, đã sắp theo thứ tự size hiển thị. */
      async listSellableVariants(productId: bigint): Promise<Array<{ sku: string; price: bigint; stockQuantity: number }>> {
            return this.prisma.productVariant.findMany({
                  where: { productId, isActive: true, product: { archivedAt: null } },
                  orderBy: [{ colorId: 'asc' }, { size: { sortOrder: 'asc' } }],
                  select: { sku: true, price: true, stockQuantity: true },
            });
      }

      /** Thiết kế hiển thị cho khách: đã đăng và chưa lưu trữ (ràng buộc R8). */
      async listPublishedProducts(): Promise<Array<{ slug: string; name: string }>> {
            return this.prisma.product.findMany({
                  where: { status: 'PUBLISHED', archivedAt: null },
                  orderBy: { id: 'asc' },
                  select: { slug: true, name: true },
            });
      }
}

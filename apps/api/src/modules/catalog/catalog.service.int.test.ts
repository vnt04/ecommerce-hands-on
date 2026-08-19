import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase } from '../../../test/database.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CatalogService } from './catalog.service.js';

const COLORS = [
      { code: 'BLK', name: 'Đen', hexCode: '#000000' },
      { code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF' },
      { code: 'NVY', name: 'Navy', hexCode: '#1B2A4A' },
];

const SIZES = [
      { name: 'S', sortOrder: 1 },
      { name: 'M', sortOrder: 2 },
      { name: 'L', sortOrder: 3 },
      { name: 'XL', sortOrder: 4 },
      { name: '2XL', sortOrder: 5 },
];

const PRICE = 299000n;

let prisma: PrismaClient;
let service: CatalogService;

async function seedAxes(): Promise<{ categoryId: bigint; colorIds: bigint[]; sizeIds: bigint[] }> {
      const category = await prisma.category.create({
            data: { slug: 'ao-thun', name: 'Áo thun' },
            select: { id: true },
      });

      const colors = await Promise.all(COLORS.map((color) => prisma.color.create({ data: color, select: { id: true } })));
      const sizes = await Promise.all(SIZES.map((size) => prisma.size.create({ data: size, select: { id: true } })));

      return {
            categoryId: category.id,
            colorIds: colors.map((color) => color.id),
            sizeIds: sizes.map((size) => size.id),
      };
}

function baseInput(axes: Awaited<ReturnType<typeof seedAxes>>) {
      return {
            categoryId: axes.categoryId,
            designCode: 'TEE-SUNSET',
            slug: 'tee-sunset',
            name: 'Tee Sunset',
            colorIds: axes.colorIds,
            sizeIds: axes.sizeIds,
            defaultPrice: PRICE,
      };
}

beforeAll(() => {
      prisma = createTestPrismaClient();
      service = new CatalogService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await resetDatabase(prisma);
});

describe('createProductWithMatrix', () => {
      test('ba màu nhân năm size tạo đúng mười lăm biến thể', async () => {
            const axes = await seedAxes();

            const result = await service.createProductWithMatrix({ ...baseInput(axes), defaultStockQuantity: 10 });

            expect(result.variantCount).toBe(15);
            await expect(prisma.productVariant.count()).resolves.toBe(15);
      });

      test('sinh SKU đúng quy ước từ mã thiết kế', async () => {
            const axes = await seedAxes();

            await service.createProductWithMatrix(baseInput(axes));

            await expect(prisma.productVariant.findUnique({ where: { sku: 'TEE-SUNSET-BLK-2XL' } })).resolves.not.toBeNull();
      });

      test('không để lại sản phẩm mồ côi khi tạo thất bại giữa chừng', async () => {
            const axes = await seedAxes();

            await service.createProductWithMatrix(baseInput(axes));
            await expect(service.createProductWithMatrix(baseInput(axes))).rejects.toThrow();

            await expect(prisma.product.count()).resolves.toBe(1);
            await expect(prisma.productVariant.count()).resolves.toBe(15);
      });

      test('từ chối giá âm ở tầng database', async () => {
            const axes = await seedAxes();

            await expect(service.createProductWithMatrix({ ...baseInput(axes), defaultPrice: -1n })).rejects.toThrow();
      });
});

describe('setVariantsActive', () => {
      test('tắt hai tổ hợp thì còn mười ba biến thể bán được', async () => {
            const axes = await seedAxes();
            const product = await service.createProductWithMatrix(baseInput(axes));

            await service.setVariantsActive(['TEE-SUNSET-NVY-2XL', 'TEE-SUNSET-WHT-2XL'], false);

            const sellable = await service.listSellableVariants(product.productId);

            expect(sellable).toHaveLength(13);
            expect(sellable.map((variant) => variant.sku)).not.toContain('TEE-SUNSET-NVY-2XL');
      });

      test('biến thể đã tắt vẫn nằm trong database, không bị xoá', async () => {
            const axes = await seedAxes();
            await service.createProductWithMatrix(baseInput(axes));

            await service.setVariantsActive(['TEE-SUNSET-NVY-2XL'], false);

            await expect(prisma.productVariant.count()).resolves.toBe(15);
      });
});

describe('updateVariantPricing', () => {
      test('cập nhật giá và tồn theo lô', async () => {
            const axes = await seedAxes();
            await service.createProductWithMatrix(baseInput(axes));

            const updated = await service.updateVariantPricing([
                  { sku: 'TEE-SUNSET-BLK-2XL', price: 319000n, stockQuantity: 5 },
                  { sku: 'TEE-SUNSET-WHT-2XL', price: 319000n },
            ]);

            expect(updated).toBe(2);

            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: 'TEE-SUNSET-BLK-2XL' } });

            expect(variant.price).toBe(319000n);
            expect(variant.stockQuantity).toBe(5);
      });
});

describe('Vòng đời sản phẩm', () => {
      test('sản phẩm ở trạng thái nháp không hiện ra cho khách', async () => {
            const axes = await seedAxes();
            await service.createProductWithMatrix(baseInput(axes));

            await expect(service.listPublishedProducts()).resolves.toHaveLength(0);
      });

      test('sản phẩm đã lưu trữ biến khỏi danh sách công khai nhưng vẫn đọc được trực tiếp', async () => {
            const axes = await seedAxes();
            const product = await service.createProductWithMatrix(baseInput(axes));

            await prisma.product.update({ where: { id: product.productId }, data: { status: 'PUBLISHED' } });
            await expect(service.listPublishedProducts()).resolves.toHaveLength(1);

            await prisma.product.update({ where: { id: product.productId }, data: { archivedAt: new Date() } });

            await expect(service.listPublishedProducts()).resolves.toHaveLength(0);
            await expect(prisma.product.findUnique({ where: { id: product.productId } })).resolves.not.toBeNull();
      });
});

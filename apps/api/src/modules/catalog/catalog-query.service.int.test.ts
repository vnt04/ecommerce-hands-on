import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { countQueries, createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CatalogQueryService } from './catalog-query.service.js';
import { CatalogService } from './catalog.service.js';
import { productListQuerySchema } from './dto/product-query.schema.js';

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

let prisma: TestPrismaClient;
let catalog: CatalogService;
let query: CatalogQueryService;

/** Dựng schema mặc định rồi ghi đè phần cần thiết, để mỗi test chỉ nêu điều nó quan tâm. */
function parseQuery(raw: Record<string, string> = {}) {
      return productListQuerySchema.parse(raw);
}

async function seedAxes(): Promise<{ categoryId: bigint; colorIds: bigint[]; sizeIds: bigint[] }> {
      const category = await prisma.category.create({ data: { slug: 'ao-thun', name: 'Áo thun' }, select: { id: true } });
      const colors = await Promise.all(COLORS.map((color) => prisma.color.create({ data: color, select: { id: true } })));
      const sizes = await Promise.all(SIZES.map((size) => prisma.size.create({ data: size, select: { id: true } })));

      return {
            categoryId: category.id,
            colorIds: colors.map((color) => color.id),
            sizeIds: sizes.map((size) => size.id),
      };
}

async function createPublishedProduct(
      axes: Awaited<ReturnType<typeof seedAxes>>,
      overrides: { designCode: string; slug: string; name: string; price?: bigint; stock?: number },
): Promise<bigint> {
      const result = await catalog.createProductWithMatrix({
            categoryId: axes.categoryId,
            designCode: overrides.designCode,
            slug: overrides.slug,
            name: overrides.name,
            colorIds: axes.colorIds,
            sizeIds: axes.sizeIds,
            defaultPrice: overrides.price ?? PRICE,
            defaultStockQuantity: overrides.stock ?? 10,
      });

      await prisma.product.update({ where: { id: result.productId }, data: { status: 'PUBLISHED' } });

      return result.productId;
}

beforeAll(() => {
      prisma = createTestPrismaClient();
      catalog = new CatalogService(prisma as unknown as PrismaService);
      query = new CatalogQueryService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await resetDatabase(prisma);
});

describe('listProducts', () => {
      test('trả thẻ sản phẩm chứ không trả toàn bộ ma trận biến thể', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });

            const result = await query.listProducts(parseQuery());

            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toEqual({
                  slug: 'tee-sunset',
                  name: 'Tee Sunset',
                  minPrice: '299000',
                  colors: expect.arrayContaining([{ code: 'BLK', name: 'Đen', hexCode: '#000000' }]),
                  inStock: true,
            });
            expect(result.items[0]).not.toHaveProperty('variants');
      });

      test('giá thấp nhất lấy trên toàn bộ biến thể đang bật', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });
            await catalog.updateVariantPricing([{ sku: 'TEE-SUNSET-BLK-S', price: 199000n }]);

            const result = await query.listProducts(parseQuery());

            expect(result.items[0]?.minPrice).toBe('199000');
      });

      test('lọc theo size ở mức biến thể, không ở mức sản phẩm', async () => {
            // Thiết kế có size 2XL trên lý thuyết, nhưng mọi tổ hợp 2XL đã bị tắt.
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });
            await catalog.setVariantsActive(['TEE-SUNSET-BLK-2XL', 'TEE-SUNSET-WHT-2XL', 'TEE-SUNSET-NVY-2XL'], false);

            await expect(query.listProducts(parseQuery({ size: '2XL' }))).resolves.toMatchObject({ items: [] });
            await expect(query.listProducts(parseQuery({ size: 'L' }))).resolves.toMatchObject({ items: [expect.anything()] });
      });

      test('lọc còn hàng bỏ qua biến thể hết hàng', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset', stock: 0 });

            await expect(query.listProducts(parseQuery({ inStock: 'true' }))).resolves.toMatchObject({ items: [] });
            await expect(query.listProducts(parseQuery())).resolves.toMatchObject({ items: [expect.anything()] });
      });

      test('lọc theo khoảng giá', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-A', slug: 'tee-a', name: 'Tee A', price: 199000n });
            await createPublishedProduct(axes, { designCode: 'TEE-B', slug: 'tee-b', name: 'Tee B', price: 499000n });

            const result = await query.listProducts(parseQuery({ minPrice: '400000' }));

            expect(result.items.map((item) => item.slug)).toEqual(['tee-b']);
      });

      test('tìm kiếm không dấu vẫn ra kết quả có dấu', async () => {
            // Đây là lý do tồn tại của extension unaccent và hàm bọc bất biến.
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-HH', slug: 'tee-hoang-hon', name: 'Áo Hoàng Hôn' });

            const result = await query.listProducts(parseQuery({ q: 'hoang hon' }));

            expect(result.items.map((item) => item.name)).toEqual(['Áo Hoàng Hôn']);
      });

      test('phân trang trả đúng tổng số và đúng lát cắt', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-A', slug: 'tee-a', name: 'Tee A' });
            await createPublishedProduct(axes, { designCode: 'TEE-B', slug: 'tee-b', name: 'Tee B' });

            const page2 = await query.listProducts(parseQuery({ page: '2', limit: '1' }));

            expect(page2.meta).toEqual({ page: 2, limit: 1, total: 2 });
            expect(page2.items.map((item) => item.slug)).toEqual(['tee-b']);
      });

      test('sản phẩm nháp và sản phẩm đã lưu trữ không lộ ra', async () => {
            const axes = await seedAxes();
            const draftId = await createPublishedProduct(axes, { designCode: 'TEE-A', slug: 'tee-a', name: 'Tee A' });
            await prisma.product.update({ where: { id: draftId }, data: { status: 'DRAFT' } });

            await expect(query.listProducts(parseQuery())).resolves.toMatchObject({ items: [] });

            await prisma.product.update({ where: { id: draftId }, data: { status: 'PUBLISHED', archivedAt: new Date() } });

            await expect(query.listProducts(parseQuery())).resolves.toMatchObject({ items: [] });
      });

      test('số truy vấn không tăng theo số sản phẩm', async () => {
            // Chốt chặn chống N+1. Nếu ai đó đổi sang cách dựng bằng include, số truy
            // vấn sẽ tăng theo số sản phẩm và test này đỏ ngay.
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-A', slug: 'tee-a', name: 'Tee A' });

            const oneProduct = await countQueries(prisma, () => query.listProducts(parseQuery()));

            await createPublishedProduct(axes, { designCode: 'TEE-B', slug: 'tee-b', name: 'Tee B' });
            await createPublishedProduct(axes, { designCode: 'TEE-C', slug: 'tee-c', name: 'Tee C' });

            const threeProducts = await countQueries(prisma, () => query.listProducts(parseQuery()));

            expect(threeProducts).toBe(oneProduct);
      });
});

describe('getProductBySlug', () => {
      test('trả cả biến thể hết hàng để giao diện hiển thị vô hiệu hoá', async () => {
            // Ràng buộc R9: size hết hàng phải hiện ở trạng thái vô hiệu hoá, không ẩn.
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });
            await catalog.updateVariantPricing([{ sku: 'TEE-SUNSET-BLK-M', stockQuantity: 0 }]);

            const detail = await query.getProductBySlug('tee-sunset');

            const outOfStock = detail.variants.filter((variant) => !variant.inStock);

            expect(outOfStock.map((variant) => variant.sku)).toEqual(['TEE-SUNSET-BLK-M']);
            expect(detail.variants).toHaveLength(15);
      });

      test('không trả biến thể đã tắt', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });
            await catalog.setVariantsActive(['TEE-SUNSET-NVY-2XL'], false);

            const detail = await query.getProductBySlug('tee-sunset');

            expect(detail.variants).toHaveLength(14);
            expect(detail.variants.map((variant) => variant.sku)).not.toContain('TEE-SUNSET-NVY-2XL');
      });

      test('size sắp theo thứ tự hiển thị, không theo bảng chữ cái', async () => {
            const axes = await seedAxes();
            await createPublishedProduct(axes, { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' });

            const detail = await query.getProductBySlug('tee-sunset');

            expect(detail.sizes.map((size) => size.name)).toEqual(['S', 'M', 'L', 'XL', '2XL']);
      });

      test('ném lỗi khi slug không tồn tại', async () => {
            await expect(query.getProductBySlug('khong-co')).rejects.toThrow();
      });

      test('ném lỗi khi sản phẩm chưa đăng', async () => {
            const axes = await seedAxes();
            const productId = await createPublishedProduct(axes, { designCode: 'TEE-A', slug: 'tee-a', name: 'Tee A' });
            await prisma.product.update({ where: { id: productId }, data: { status: 'DRAFT' } });

            await expect(query.getProductBySlug('tee-a')).rejects.toThrow();
      });
});

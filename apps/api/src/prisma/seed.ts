import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { buildVariantMatrix } from '../modules/catalog/domain/variant-matrix.js';

/**
 * Dữ liệu mẫu đủ thật để dùng thử: hai thiết kế, đủ màu và size, có tổ hợp bị tắt
 * và có SKU hết hàng. Dữ liệu quá sạch che mất đúng những trạng thái hay hỏng nhất.
 *
 * Chạy lại được nhiều lần: mọi thao tác ghi đều dùng upsert hoặc bỏ qua khi đã tồn tại.
 */
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

const BASE_PRICE = 299000n;
const LARGE_SIZE_PRICE = 319000n;
const DEFAULT_STOCK = 20;
const TSHIRT_WEIGHT_GRAMS = 220;

const DESIGNS = [
      { designCode: 'TEE-SUNSET', slug: 'tee-sunset', name: 'Tee Sunset' },
      { designCode: 'TEE-MOUNTAIN', slug: 'tee-mountain', name: 'Tee Mountain' },
];

/** Navy không sản xuất size 2XL. Tổ hợp bị tắt chứ không bị xoá khỏi ma trận. */
const DISABLED_SKUS = ['TEE-SUNSET-NVY-2XL', 'TEE-MOUNTAIN-NVY-2XL'];

/** Một SKU hết hàng để trang sản phẩm có trạng thái vô hiệu hoá mà kiểm chứng. */
const OUT_OF_STOCK_SKUS = ['TEE-SUNSET-BLK-M'];

async function main(): Promise<void> {
      const connectionString = process.env.DATABASE_URL;

      if (connectionString === undefined) {
            throw new Error('DATABASE_URL chưa được đặt.');
      }

      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

      try {
            const category = await prisma.category.upsert({
                  where: { slug: 'ao-thun' },
                  update: {},
                  create: { slug: 'ao-thun', name: 'Áo thun', sortOrder: 1 },
                  select: { id: true },
            });

            const sizeChart = await prisma.sizeChart.upsert({
                  where: { name: 'Áo thun unisex' },
                  update: {},
                  create: {
                        name: 'Áo thun unisex',
                        measurements: SIZES.map((size, index) => ({
                              size: size.name,
                              chestWidthCm: 46 + index * 3,
                              bodyLengthCm: 66 + index * 2,
                              sleeveLengthCm: 19 + index,
                        })),
                  },
                  select: { id: true },
            });

            const colors = await Promise.all(
                  COLORS.map((color) =>
                        prisma.color.upsert({
                              where: { code: color.code },
                              update: {},
                              create: color,
                              select: { id: true, code: true },
                        }),
                  ),
            );

            const sizes = await Promise.all(
                  SIZES.map((size) =>
                        prisma.size.upsert({
                              where: { name: size.name },
                              update: {},
                              create: size,
                              select: { id: true, name: true, sortOrder: true },
                        }),
                  ),
            );

            const orderedSizes = [...sizes].sort((left, right) => left.sortOrder - right.sortOrder);

            for (const design of DESIGNS) {
                  const existing = await prisma.product.findUnique({ where: { designCode: design.designCode } });

                  if (existing !== null) {
                        continue;
                  }

                  const matrix = buildVariantMatrix({
                        designCode: design.designCode,
                        colors,
                        sizes: orderedSizes,
                  });

                  await prisma.$transaction(async (tx) => {
                        const product = await tx.product.create({
                              data: {
                                    categoryId: category.id,
                                    sizeChartId: sizeChart.id,
                                    designCode: design.designCode,
                                    slug: design.slug,
                                    name: design.name,
                                    description: 'Áo thun cotton in hình, form unisex.',
                                    material: 'Cotton 100%, 250gsm',
                                    careGuide: 'Giặt máy nước lạnh, lộn trái, không sấy khô.',
                                    printMethod: 'In lụa',
                                    status: 'PUBLISHED',
                              },
                              select: { id: true },
                        });

                        await tx.productVariant.createMany({
                              data: matrix.map((combination) => ({
                                    productId: product.id,
                                    colorId: combination.colorId,
                                    sizeId: combination.sizeId,
                                    sku: combination.sku,
                                    // Size lớn tốn nhiều vải hơn nên có giá khác.
                                    price: combination.sku.endsWith('-2XL') ? LARGE_SIZE_PRICE : BASE_PRICE,
                                    stockQuantity: OUT_OF_STOCK_SKUS.includes(combination.sku) ? 0 : DEFAULT_STOCK,
                                    weightGrams: TSHIRT_WEIGHT_GRAMS,
                                    isActive: !DISABLED_SKUS.includes(combination.sku),
                              })),
                        });
                  });
            }

            const [productCount, variantCount, sellableCount] = await Promise.all([
                  prisma.product.count(),
                  prisma.productVariant.count(),
                  prisma.productVariant.count({ where: { isActive: true } }),
            ]);

            process.stdout.write(`Seed xong: ${productCount} thiết kế, ${variantCount} biến thể, ${sellableCount} biến thể bán được\n`);
      } finally {
            await prisma.$disconnect();
      }
}

await main();

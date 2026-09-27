import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

import { buildVariantMatrix } from '../modules/catalog/domain/variant-matrix.js';

/**
 * Catalog demo có nhiều thiết kế và ma trận màu/size, tồn kho không đồng đều,
 * một số SKU hết hàng và một số tổ hợp không được sản xuất.
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

const TSHIRT_WEIGHT_GRAMS = 220;
const LEGACY_SEED_DESCRIPTION = 'Áo thun cotton in hình, form unisex.';

/**
 * Tài khoản quản trị cho môi trường phát triển.
 *
 * Không có đường tự đăng ký thành ADMIN, nên đây là lối vào duy nhất lúc này.
 * Seed không chạy trên production, nên môi trường thật vẫn cần một cách khác —
 * ghi trong docs/steps/S06.md để bước lên production không phát hiện muộn.
 */
const ADMIN_EMAIL = 'admin@shopflow.local';
const ADMIN_PASSWORD = 'admin-doi-mat-khau-ngay';
const BCRYPT_COST = 12;

const DESIGNS = [
      {
            designCode: 'TEE-SUNSET',
            slug: 'tee-sunset',
            name: 'Áo thun Sunset',
            description: 'Áo thun dáng relaxed với hình mặt trời cuối ngày tối giản, dễ phối cùng denim và quần short.',
            material: 'Cotton chải kỹ 100%, định lượng 250gsm',
            careGuide: 'Giặt máy tối đa 30°C, lộn trái áo khi giặt và ủi; tránh sấy nhiệt cao.',
            printMethod: 'In lụa mực nước',
            basePrice: 299000n,
      },
      {
            designCode: 'TEE-MOUNTAIN',
            slug: 'tee-mountain',
            name: 'Áo thun Mountain',
            description: 'Hình núi và mặt trời nét mảnh lấy cảm hứng từ những chuyến đi cuối tuần; form unisex thoải mái.',
            material: 'Cotton chải kỹ 100%, định lượng 250gsm',
            careGuide: 'Giặt máy tối đa 30°C với màu tương tự, lộn trái áo khi giặt; phơi nơi thoáng mát.',
            printMethod: 'In lụa mực nước',
            basePrice: 319000n,
      },
      {
            designCode: 'TEE-COAST',
            slug: 'tee-coastline',
            name: 'Áo thun Coastline',
            description: 'Đường sóng nhỏ gọn ở ngực áo, gợi cảm hứng từ những ngày đi biển và phong cách thường ngày nhẹ nhàng.',
            material: 'Cotton compact 100%, định lượng 240gsm',
            careGuide: 'Giặt máy chế độ nhẹ tối đa 30°C, lộn trái áo; không ủi trực tiếp lên hình in.',
            printMethod: 'In lụa mực nước',
            basePrice: 279000n,
      },
      {
            designCode: 'TEE-BOTANICAL',
            slug: 'tee-botanical',
            name: 'Áo thun Botanical',
            description: 'Họa tiết lá thực vật được tinh giản thành một điểm nhấn nhỏ, phù hợp mặc riêng hoặc phối layer.',
            material: 'Cotton hữu cơ 100%, định lượng 230gsm',
            careGuide: 'Giặt với nước lạnh cùng màu tương tự, dùng chất giặt dịu nhẹ; phơi tự nhiên để giữ phom áo.',
            printMethod: 'In lụa mực gốc nước',
            basePrice: 329000n,
      },
      {
            designCode: 'TEE-ORBIT',
            slug: 'tee-orbit',
            name: 'Áo thun Orbit',
            description: 'Minh họa quỹ đạo nhỏ với bảng màu trầm, dành cho người thích chi tiết đồ họa kín đáo.',
            material: 'Cotton chải kỹ 100%, định lượng 250gsm',
            careGuide: 'Lộn trái áo trước khi giặt, giặt máy tối đa 30°C; không dùng thuốc tẩy.',
            printMethod: 'In lụa nhiều lớp',
            basePrice: 309000n,
      },
      {
            designCode: 'TEE-ARCH',
            slug: 'tee-arch',
            name: 'Áo thun Arch',
            description: 'Hình khối vòm cân đối tạo điểm nhấn hiện đại nhưng vẫn dễ mặc trong nhiều dịp.',
            material: 'Cotton compact 100%, định lượng 250gsm',
            careGuide: 'Giặt máy chế độ nhẹ, lộn trái áo khi giặt và ủi; phơi ngang để hạn chế bai vai.',
            printMethod: 'In lụa mực nước',
            basePrice: 289000n,
      },
      ...Array.from({ length: 54 }, (_, index) => {
            const edition = String(index + 1).padStart(3, '0');
            const theme = [
                  {
                        name: 'Sunset',
                        motif: 'mặt trời cuối ngày',
                        material: 'Cotton chải kỹ 100%, định lượng 250gsm',
                        printMethod: 'In lụa mực nước',
                  },
                  {
                        name: 'Mountain',
                        motif: 'đường nét núi và mặt trời',
                        material: 'Cotton compact 100%, định lượng 240gsm',
                        printMethod: 'In lụa mực nước',
                  },
                  {
                        name: 'Coastline',
                        motif: 'đường sóng ven biển',
                        material: 'Cotton compact 100%, định lượng 240gsm',
                        printMethod: 'In lụa mực nước',
                  },
                  {
                        name: 'Botanical',
                        motif: 'họa tiết lá thực vật',
                        material: 'Cotton hữu cơ 100%, định lượng 230gsm',
                        printMethod: 'In lụa mực gốc nước',
                  },
                  {
                        name: 'Orbit',
                        motif: 'quỹ đạo và hành tinh',
                        material: 'Cotton chải kỹ 100%, định lượng 250gsm',
                        printMethod: 'In lụa nhiều lớp',
                  },
                  {
                        name: 'Arch',
                        motif: 'hình khối vòm tối giản',
                        material: 'Cotton compact 100%, định lượng 250gsm',
                        printMethod: 'In lụa mực nước',
                  },
            ][index % 6]!;

            return {
                  designCode: `TEE-DEMO-${edition}`,
                  slug: `tee-demo-${edition}`,
                  name: `Áo thun ${theme.name} ${edition}`,
                  description: `Phiên bản ${edition} với ${theme.motif}, form unisex dễ phối cho trang phục hằng ngày.`,
                  material: theme.material,
                  careGuide: 'Giặt máy tối đa 30°C, lộn trái áo khi giặt; không ủi trực tiếp lên hình in.',
                  printMethod: theme.printMethod,
                  basePrice: 269000n + BigInt((index * 3) % 10) * 10000n,
            };
      }),
];

/** Navy không sản xuất size 2XL. Tổ hợp bị tắt chứ không bị xoá khỏi ma trận. */
const DISABLED_SKUS = DESIGNS.map((design) => `${design.designCode}-NVY-2XL`);

/** Một SKU hết hàng để trang sản phẩm có trạng thái vô hiệu hoá mà kiểm chứng. */
const OUT_OF_STOCK_SKUS = [
      'TEE-SUNSET-BLK-M',
      'TEE-COAST-WHT-L',
      'TEE-ORBIT-NVY-S',
      ...DESIGNS.filter((_, index) => index >= 6 && index % 5 === 0).map((design) => `${design.designCode}-BLK-M`),
];

async function main(): Promise<void> {
      const connectionString = process.env.DATABASE_URL;

      if (connectionString === undefined) {
            throw new Error('DATABASE_URL chưa được đặt.');
      }

      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

      try {
            await prisma.user.upsert({
                  where: { email: ADMIN_EMAIL },
                  update: {},
                  create: {
                        email: ADMIN_EMAIL,
                        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST),
                        fullName: 'Quản trị viên',
                        role: 'ADMIN',
                  },
            });

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

            for (const [designIndex, design] of DESIGNS.entries()) {
                  const existing = await prisma.product.findUnique({ where: { designCode: design.designCode } });

                  if (existing !== null) {
                        // Nâng dữ liệu seed cũ, nhưng không ghi đè nội dung đã được quản trị viên chỉnh sửa.
                        if (existing.description === LEGACY_SEED_DESCRIPTION) {
                              await prisma.$transaction(async (tx) => {
                                    await tx.product.update({
                                          where: { id: existing.id },
                                          data: {
                                                name: design.name,
                                                description: design.description,
                                                material: design.material,
                                                careGuide: design.careGuide,
                                                printMethod: design.printMethod,
                                          },
                                    });

                                    const existingVariants = await tx.productVariant.findMany({
                                          where: { productId: existing.id },
                                          select: { sku: true },
                                          orderBy: { sku: 'asc' },
                                    });

                                    for (const [index, variant] of existingVariants.entries()) {
                                          await tx.productVariant.update({
                                                where: { sku: variant.sku },
                                                data: {
                                                      price: design.basePrice + (variant.sku.endsWith('-2XL') ? 20000n : 0n),
                                                      stockQuantity: OUT_OF_STOCK_SKUS.includes(variant.sku)
                                                            ? 0
                                                            : 5 + ((index * 7 + designIndex * 3) % 21),
                                                      isActive: !DISABLED_SKUS.includes(variant.sku),
                                                },
                                          });
                                    }
                              });
                        } else if (existing.description === design.description) {
                              // Chỉ nâng bảng giá nếu toàn bộ SKU vẫn khớp chính xác giá mặc định của seed đời trước.
                              const previousSeedVariants = await prisma.productVariant.findMany({
                                    where: { productId: existing.id },
                                    select: { sku: true, price: true },
                              });
                              const stillHasPreviousSeedPrices = previousSeedVariants.every(
                                    (variant) => variant.price === (variant.sku.endsWith('-2XL') ? 319000n : 299000n),
                              );

                              if (stillHasPreviousSeedPrices && design.basePrice !== 299000n) {
                                    await prisma.$transaction(
                                          previousSeedVariants.map((variant) =>
                                                prisma.productVariant.update({
                                                      where: { sku: variant.sku },
                                                      data: {
                                                            price: design.basePrice + (variant.sku.endsWith('-2XL') ? 20000n : 0n),
                                                      },
                                                }),
                                          ),
                                    );
                              }
                        }

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
                                    description: design.description,
                                    material: design.material,
                                    careGuide: design.careGuide,
                                    printMethod: design.printMethod,
                                    status: 'PUBLISHED',
                              },
                              select: { id: true },
                        });

                        await tx.productVariant.createMany({
                              data: matrix.map((combination, index) => ({
                                    productId: product.id,
                                    colorId: combination.colorId,
                                    sizeId: combination.sizeId,
                                    sku: combination.sku,
                                    // Size 2XL tốn thêm vải; tồn kho được chia không đồng đều như catalog bán thật.
                                    price: design.basePrice + (combination.sku.endsWith('-2XL') ? 20000n : 0n),
                                    stockQuantity: OUT_OF_STOCK_SKUS.includes(combination.sku)
                                          ? 0
                                          : 5 + ((index * 7 + designIndex * 3) % 21),
                                    weightGrams: TSHIRT_WEIGHT_GRAMS,
                                    isActive: !DISABLED_SKUS.includes(combination.sku),
                              })),
                        });
                  });
            }

            const [productCount, variantCount, sellableCount] = await Promise.all([
                  prisma.product.count({ where: { categoryId: category.id } }),
                  prisma.productVariant.count({ where: { product: { categoryId: category.id } } }),
                  prisma.productVariant.count({ where: { isActive: true, product: { categoryId: category.id } } }),
            ]);

            process.stdout.write(`Seed xong: ${productCount} thiết kế, ${variantCount} biến thể, ${sellableCount} biến thể bán được\n`);
      } finally {
            await prisma.$disconnect();
      }
}

await main();

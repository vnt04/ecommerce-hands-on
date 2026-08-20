import type { ShippingInfo } from '@shopflow/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { CatalogService } from './catalog.service.js';
import { ProductAdminService } from './product-admin.service.js';

const PRICE = 299_000n;
const STOCK = 10;

const SHIPPING: ShippingInfo = {
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0912345678',
      addressLine: '12 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      province: 'TP Hồ Chí Minh',
};

let prisma: TestPrismaClient;
let admin: ProductAdminService;
let catalog: CatalogService;
let carts: CartService;
let orders: OrdersService;

let categoryId: bigint;
let colorIds: { black: bigint; white: bigint; navy: bigint };
let sizeIds: { small: bigint; medium: bigint; large: bigint };

async function seedAxes(): Promise<void> {
      const category = await prisma.category.create({ data: { slug: 'ao-thun', name: 'Áo thun' }, select: { id: true } });
      const black = await prisma.color.create({ data: { code: 'BLK', name: 'Đen', hexCode: '#000000' }, select: { id: true } });
      const white = await prisma.color.create({ data: { code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF' }, select: { id: true } });
      const navy = await prisma.color.create({ data: { code: 'NVY', name: 'Navy', hexCode: '#1B2A4A' }, select: { id: true } });
      const small = await prisma.size.create({ data: { name: 'S', sortOrder: 1 }, select: { id: true } });
      const medium = await prisma.size.create({ data: { name: 'M', sortOrder: 2 }, select: { id: true } });
      const large = await prisma.size.create({ data: { name: 'L', sortOrder: 3 }, select: { id: true } });

      categoryId = category.id;
      colorIds = { black: black.id, white: white.id, navy: navy.id };
      sizeIds = { small: small.id, medium: medium.id, large: large.id };
}

/** Tạo một thiết kế hai màu nhân hai size, đã xuất bản. */
async function createProduct(slug = 'ao-thun-basic', designCode = 'TSA001'): Promise<void> {
      const result = await catalog.createProductWithMatrix({
            categoryId,
            designCode,
            slug,
            name: 'Áo thun basic',
            colorIds: [colorIds.black, colorIds.white],
            sizeIds: [sizeIds.small, sizeIds.medium],
            defaultPrice: PRICE,
            defaultStockQuantity: STOCK,
      });

      await prisma.product.update({ where: { id: result.productId }, data: { status: 'PUBLISHED' } });
}

let sequence = 0;

async function createAdminUser(): Promise<bigint> {
      sequence += 1;

      const user = await prisma.user.create({
            data: { email: 'admin' + sequence + '@example.com', passwordHash: 'x', fullName: 'Quản trị ' + sequence, role: 'ADMIN' },
            select: { id: true },
      });

      return user.id;
}

async function stockOf(sku: string): Promise<number> {
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku }, select: { stockQuantity: true } });

      return variant.stockQuantity;
}

let actorId: bigint;

beforeAll(() => {
      prisma = createTestPrismaClient();
      admin = new ProductAdminService(prisma as unknown as PrismaService);
      catalog = new CatalogService(prisma as unknown as PrismaService);
      carts = new CartService(prisma as unknown as PrismaService);
      orders = new OrdersService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await prisma.$executeRawUnsafe(
            'TRUNCATE variant_changes, order_status_history, idempotency_keys, order_items, orders, order_number_counters, refresh_tokens, users RESTART IDENTITY CASCADE',
      );
      await resetDatabase(prisma);
      await seedAxes();
      await createProduct();
      actorId = await createAdminUser();
});

describe('danh sách thiết kế', () => {
      test('gồm cả bản nháp, và nêu tổng tồn của từng thiết kế', async () => {
            await catalog.createProductWithMatrix({
                  categoryId,
                  designCode: 'TSA002',
                  slug: 'ao-thun-nhap',
                  name: 'Bản nháp',
                  colorIds: [colorIds.black],
                  sizeIds: [sizeIds.small],
                  defaultPrice: PRICE,
                  defaultStockQuantity: 3,
            });

            const result = await admin.list({ includeArchived: false, page: 1 });

            expect(result.total).toBe(2);
            expect(result.items.map((item) => item.slug)).toContain('ao-thun-nhap');
            expect(result.items.find((item) => item.slug === 'ao-thun-basic')?.totalStock).toBe(STOCK * 4);
      });

      test('lọc theo trạng thái', async () => {
            const result = await admin.list({ status: 'PUBLISHED', includeArchived: false, page: 1 });

            expect(result.total).toBe(1);
      });

      test('bản đã lưu trữ mặc định không hiện', async () => {
            await admin.update('ao-thun-basic', { archived: true });

            expect((await admin.list({ includeArchived: false, page: 1 })).total).toBe(0);
            expect((await admin.list({ includeArchived: true, page: 1 })).total).toBe(1);
      });

      test('tìm theo mã thiết kế', async () => {
            expect((await admin.list({ search: 'TSA001', includeArchived: false, page: 1 })).total).toBe(1);
            expect((await admin.list({ search: 'KHONG-CO', includeArchived: false, page: 1 })).total).toBe(0);
      });
});

describe('sửa thiết kế', () => {
      test('lưu trữ rồi bỏ lưu trữ', async () => {
            expect((await admin.update('ao-thun-basic', { archived: true })).isArchived).toBe(true);
            expect((await admin.update('ao-thun-basic', { archived: false })).isArchived).toBe(false);
      });

      test('thiết kế đã lưu trữ biến khỏi catalog công khai', async () => {
            await admin.update('ao-thun-basic', { archived: true });

            expect(await catalog.listPublishedProducts()).toHaveLength(0);
      });

      test('đổi tên không đụng tới mã thiết kế và SKU', async () => {
            // ADR-006: SKU sinh từ mã thiết kế, không từ tên hiển thị.
            const before = (await admin.detail('ao-thun-basic')).variants.map((variant) => variant.sku);

            await admin.update('ao-thun-basic', { name: 'Tên hoàn toàn khác' });

            const after = await admin.detail('ao-thun-basic');
            expect(after.name).toBe('Tên hoàn toàn khác');
            expect(after.designCode).toBe('TSA001');
            expect(after.variants.map((variant) => variant.sku)).toEqual(before);
      });

      test('thiết kế không tồn tại thì báo không tìm thấy', async () => {
            await expect(admin.detail('khong-ton-tai')).rejects.toMatchObject({ status: 404 });
      });
});

describe('mở rộng ma trận', () => {
      test('thêm một màu sinh thêm đúng số tổ hợp còn thiếu', async () => {
            // Đang có 2 màu × 2 size = 4. Thêm màu thứ ba thì phải thành 6.
            const result = await admin.extendMatrix('ao-thun-basic', [colorIds.navy], [], PRICE);

            expect(result.variants).toHaveLength(6);
      });

      test('thêm một size sinh thêm đúng số tổ hợp còn thiếu', async () => {
            const result = await admin.extendMatrix('ao-thun-basic', [], [sizeIds.large], PRICE);

            expect(result.variants).toHaveLength(6);
      });

      test('thêm cả màu lẫn size sinh đủ ma trận mới', async () => {
            // 3 màu × 3 size = 9.
            const result = await admin.extendMatrix('ao-thun-basic', [colorIds.navy], [sizeIds.large], PRICE);

            expect(result.variants).toHaveLength(9);
      });

      test('không đụng tới biến thể đã có: giá và tồn giữ nguyên', async () => {
            const target = (await admin.detail('ao-thun-basic')).variants[0];
            await admin.adjustStock(target.sku, 5, actorId);
            await admin.updateVariant(target.sku, { price: 350_000n }, actorId);

            await admin.extendMatrix('ao-thun-basic', [colorIds.navy], [], PRICE);

            const after = (await admin.detail('ao-thun-basic')).variants.find((variant) => variant.sku === target.sku);
            expect(after?.stockQuantity).toBe(STOCK + 5);
            expect(after?.price).toBe('350000');
      });

      test('ma trận đã đầy đủ thì từ chối, không sinh dòng nào', async () => {
            const failure = await admin
                  .extendMatrix('ao-thun-basic', [colorIds.black], [sizeIds.small], PRICE)
                  .catch((error: unknown) => error);

            expect((failure as DomainException).details).toMatchObject({ reason: 'MATRIX_COMPLETE' });
            expect((await admin.detail('ao-thun-basic')).variants).toHaveLength(4);
      });
});

describe('đổi giá', () => {
      test('ghi lịch sử kèm hai đầu và người thực hiện', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            await admin.updateVariant(sku, { price: 350_000n, reason: 'Tăng giá vải' }, actorId);

            const history = await admin.historyOf(sku);
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject({ kind: 'PRICE', from: '299000', to: '350000', reason: 'Tăng giá vải' });
            expect(history[0].changedBy).not.toBeNull();
      });

      test('đặt lại đúng giá cũ thì không sinh dòng lịch sử', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            await admin.updateVariant(sku, { price: PRICE }, actorId);

            expect(await admin.historyOf(sku)).toHaveLength(0);
      });

      test('đổi giá không làm đổi tổng tiền của đơn đã đặt (R4)', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            const user = await prisma.user.create({
                  data: { email: 'khach@example.com', passwordHash: 'x', fullName: 'Khách' },
                  select: { id: true },
            });
            const cartId = (await carts.findOrCreate({ userId: user.id })).id;
            await carts.addItem(cartId, sku, 2);
            const order = await orders.placeOrder({ userId: user.id, shipping: SHIPPING, idempotencyKey: 'idem-key-r4-0123456789' });

            await admin.updateVariant(sku, { price: 999_000n }, actorId);

            const reloaded = await orders.findByNumber(order.orderNumber, user.id);
            expect(reloaded.total).toBe('598000');
      });

      test('tắt tổ hợp thì nó biến khỏi danh sách bán được', async () => {
            const detail = await admin.detail('ao-thun-basic');
            const sku = detail.variants[0].sku;
            const product = await prisma.product.findUniqueOrThrow({ where: { slug: 'ao-thun-basic' }, select: { id: true } });

            await admin.updateVariant(sku, { isActive: false }, actorId);

            const sellable = await catalog.listSellableVariants(product.id);
            expect(sellable.map((variant) => variant.sku)).not.toContain(sku);
      });

      test('tổ hợp không tồn tại thì báo không tìm thấy', async () => {
            await expect(admin.updateVariant('KHONG-CO', { price: PRICE }, actorId)).rejects.toMatchObject({ status: 404 });
      });
});

describe('nhập và điều chỉnh tồn kho', () => {
      test('nhập thêm cộng vào tồn hiện có và ghi lịch sử', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            const result = await admin.adjustStock(sku, 10, actorId, 'Nhập hàng đợt 3');

            expect(result.stockAfter).toBe(STOCK + 10);

            const history = await admin.historyOf(sku);
            expect(history[0]).toMatchObject({ kind: 'STOCK', delta: 10, stockAfter: STOCK + 10, reason: 'Nhập hàng đợt 3' });
      });

      test('điều chỉnh giảm bằng số âm', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            expect((await admin.adjustStock(sku, -3, actorId, 'Kiểm kho phát hiện thiếu')).stockAfter).toBe(STOCK - 3);
      });

      test('giảm quá tồn hiện có bị từ chối và tồn không đổi', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            const failure = await admin.adjustStock(sku, -(STOCK + 1), actorId).catch((error: unknown) => error);

            expect((failure as DomainException).details).toMatchObject({ reason: 'INSUFFICIENT_STOCK', availableQuantity: STOCK });
            expect(await stockOf(sku)).toBe(STOCK);
      });

      /**
       * Đây là test quan trọng nhất của S09b.
       *
       * Nhập tồn bằng cách đặt giá trị tuyệt đối sẽ xoá mất những đơn đặt xen vào
       * giữa. Ghi theo lượng cộng thêm thì kết quả luôn bằng tổng của mọi thao tác,
       * bất kể thứ tự.
       */
      test('nhập tồn đồng thời với đơn hàng: không thao tác nào bị mất', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;
            const BUYERS = 3;
            const RESTOCKS = 5;

            const buyers = await Promise.all(
                  Array.from({ length: BUYERS }, async (_unused, index) => {
                        const user = await prisma.user.create({
                              data: { email: 'mua' + index + '@example.com', passwordHash: 'x', fullName: 'Khách ' + index },
                              select: { id: true },
                        });
                        const cartId = (await carts.findOrCreate({ userId: user.id })).id;
                        await carts.addItem(cartId, sku, 1);

                        return { userId: user.id, key: 'idem-key-mua' + index + '-0123456789' };
                  }),
            );

            await Promise.all([
                  ...buyers.map((buyer) => orders.placeOrder({ userId: buyer.userId, shipping: SHIPPING, idempotencyKey: buyer.key })),
                  ...Array.from({ length: RESTOCKS }, () => admin.adjustStock(sku, 2, actorId, 'Nhập hàng')),
            ]);

            // Tồn cũ, trừ đi số đơn, cộng thêm số lần nhập.
            expect(await stockOf(sku)).toBe(STOCK - BUYERS + RESTOCKS * 2);
      });

      test('nhiều lần nhập đồng thời cộng đủ, không mất lần nào', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;
            const TIMES = 10;

            await Promise.all(Array.from({ length: TIMES }, () => admin.adjustStock(sku, 3, actorId)));

            expect(await stockOf(sku)).toBe(STOCK + TIMES * 3);
            expect(await admin.historyOf(sku)).toHaveLength(TIMES);
      });

      test('lịch sử gồm cả thay đổi giá lẫn thay đổi tồn, mới nhất lên trước', async () => {
            const sku = (await admin.detail('ao-thun-basic')).variants[0].sku;

            await admin.adjustStock(sku, 5, actorId);
            await admin.updateVariant(sku, { price: 350_000n }, actorId);

            const history = await admin.historyOf(sku);
            expect(history.map((entry) => entry.kind)).toEqual(['PRICE', 'STOCK']);
      });
});

describe('ràng buộc cơ sở dữ liệu', () => {
      test('một dòng lịch sử không thể mang cả giá lẫn tồn kho', async () => {
            const variant = await prisma.productVariant.findFirstOrThrow({ select: { id: true } });

            await expect(
                  prisma.variantChange.create({
                        data: { variantId: variant.id, priceFrom: 1n, priceTo: 2n, stockDelta: 1, stockAfter: 2 },
                  }),
            ).rejects.toThrow();
      });

      test('một dòng lịch sử không thể rỗng cả hai loại', async () => {
            const variant = await prisma.productVariant.findFirstOrThrow({ select: { id: true } });

            await expect(prisma.variantChange.create({ data: { variantId: variant.id, reason: 'Không nói gì' } })).rejects.toThrow();
      });

      test('lượng điều chỉnh tồn bằng 0 bị chặn ở tầng cơ sở dữ liệu', async () => {
            const variant = await prisma.productVariant.findFirstOrThrow({ select: { id: true } });

            await expect(prisma.variantChange.create({ data: { variantId: variant.id, stockDelta: 0, stockAfter: 5 } })).rejects.toThrow();
      });
});

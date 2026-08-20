import type { ShippingInfo } from '@shopflow/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { OrderAdminService } from './order-admin.service.js';
import { OrdersService } from './orders.service.js';

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
let orders: OrdersService;
let admin: OrderAdminService;
let carts: CartService;
let catalog: CatalogService;

let skuFirst: string;

async function seedCatalog(): Promise<void> {
      const category = await prisma.category.create({ data: { slug: 'ao-thun', name: 'Áo thun' }, select: { id: true } });
      const black = await prisma.color.create({ data: { code: 'BLK', name: 'Đen', hexCode: '#000000' }, select: { id: true } });
      const small = await prisma.size.create({ data: { name: 'S', sortOrder: 1 }, select: { id: true } });

      const result = await catalog.createProductWithMatrix({
            categoryId: category.id,
            designCode: 'TSA001',
            slug: 'ao-thun-basic',
            name: 'Áo thun basic',
            colorIds: [black.id],
            sizeIds: [small.id],
            defaultPrice: PRICE,
            defaultStockQuantity: STOCK,
      });

      await prisma.product.update({ where: { id: result.productId }, data: { status: 'PUBLISHED' } });

      const variant = await prisma.productVariant.findFirstOrThrow({
            where: { productId: result.productId },
            select: { sku: true },
      });

      skuFirst = variant.sku;
}

let sequence = 0;

async function createUser(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER'): Promise<bigint> {
      sequence += 1;

      const user = await prisma.user.create({
            data: { email: 'nguoi' + sequence + '@example.com', passwordHash: 'x', fullName: 'Người ' + sequence, role },
            select: { id: true },
      });

      return user.id;
}

/** Đặt một đơn mới và trả về mã đơn cùng chủ đơn. */
async function placeOrder(quantity = 2): Promise<{ orderNumber: string; userId: bigint }> {
      sequence += 1;

      const userId = await createUser();
      const cartId = (await carts.findOrCreate({ userId })).id;
      await carts.addItem(cartId, skuFirst, quantity);

      const order = await orders.placeOrder({
            userId,
            shipping: SHIPPING,
            idempotencyKey: 'idem-key-' + sequence + '-0123456789',
      });

      return { orderNumber: order.orderNumber, userId };
}

async function stockOf(sku: string): Promise<number> {
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku }, select: { stockQuantity: true } });

      return variant.stockQuantity;
}

async function statusOf(orderNumber: string): Promise<string> {
      const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, select: { status: true } });

      return order.status;
}

beforeAll(() => {
      prisma = createTestPrismaClient();
      orders = new OrdersService(prisma as unknown as PrismaService);
      admin = new OrderAdminService(prisma as unknown as PrismaService, orders);
      carts = new CartService(prisma as unknown as PrismaService);
      catalog = new CatalogService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await prisma.$executeRawUnsafe(
            'TRUNCATE order_status_history, idempotency_keys, order_items, orders, order_number_counters, refresh_tokens, users RESTART IDENTITY CASCADE',
      );
      await resetDatabase(prisma);
      await seedCatalog();
});

describe('chuyển trạng thái', () => {
      test('quản trị viên xác nhận rồi giao rồi đánh dấu đã giao', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            for (const to of ['CONFIRMED', 'SHIPPING', 'DELIVERED'] as const) {
                  await admin.changeStatus({ orderNumber, to, actorId: adminId, isAdmin: true });
            }

            expect(await statusOf(orderNumber)).toBe('DELIVERED');
      });

      test('mỗi lần chuyển ghi một dòng lịch sử kèm người thực hiện', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true, note: 'Đã gọi xác nhận' });

            const history = await admin.historyOf(orderNumber);
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject({ kind: 'STATUS', from: 'PENDING', to: 'CONFIRMED', note: 'Đã gọi xác nhận' });
            expect(history[0].changedBy).not.toBeNull();
      });

      test('bước chuyển không hợp lệ bị từ chối và nêu rõ hai đầu', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });
            await admin.changeStatus({ orderNumber, to: 'SHIPPING', actorId: adminId, isAdmin: true });
            await admin.changeStatus({ orderNumber, to: 'DELIVERED', actorId: adminId, isAdmin: true });

            const failure = await admin
                  .changeStatus({ orderNumber, to: 'PENDING', actorId: adminId, isAdmin: true })
                  .catch((error: unknown) => error);

            expect(failure).toBeInstanceOf(DomainException);
            expect((failure as DomainException).details).toMatchObject({ reason: 'INVALID_TRANSITION', from: 'DELIVERED', to: 'PENDING' });
      });

      test('bước chuyển bị từ chối thì không ghi dòng lịch sử nào', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true }).catch(() => undefined);
            await admin.changeStatus({ orderNumber, to: 'PENDING', actorId: adminId, isAdmin: true }).catch(() => undefined);

            expect(await admin.historyOf(orderNumber)).toHaveLength(1);
      });

      test('đơn không tồn tại thì báo không tìm thấy', async () => {
            const adminId = await createUser('ADMIN');

            await expect(
                  admin.changeStatus({ orderNumber: 'SF-260101-9999', to: 'CONFIRMED', actorId: adminId, isAdmin: true }),
            ).rejects.toMatchObject({ status: 404 });
      });
});

describe('huỷ đơn và cộng trả tồn kho', () => {
      test('huỷ đơn cộng trả đúng số lượng đã trừ', async () => {
            const { orderNumber } = await placeOrder(3);
            const adminId = await createUser('ADMIN');

            expect(await stockOf(skuFirst)).toBe(STOCK - 3);

            await admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true, note: 'Khách đổi ý' });

            expect(await stockOf(skuFirst)).toBe(STOCK);
      });

      test('bấm huỷ hai lần không cộng trả tồn hai lần', async () => {
            const { orderNumber } = await placeOrder(3);
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true });
            await admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true }).catch(() => undefined);

            expect(await stockOf(skuFirst)).toBe(STOCK);
            expect(await admin.historyOf(orderNumber)).toHaveLength(1);
      });

      test('hai yêu cầu huỷ đồng thời chỉ có một yêu cầu ăn', async () => {
            const { orderNumber } = await placeOrder(3);
            const adminId = await createUser('ADMIN');
            const request = { orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true } as const;

            const results = await Promise.allSettled([admin.changeStatus({ ...request }), admin.changeStatus({ ...request })]);

            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
            expect(await stockOf(skuFirst)).toBe(STOCK);
      });

      test('huỷ đơn đã xác nhận vẫn cộng trả tồn', async () => {
            const { orderNumber } = await placeOrder(3);
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });
            await admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true });

            expect(await stockOf(skuFirst)).toBe(STOCK);
      });

      test('đơn đang giao không huỷ được', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });
            await admin.changeStatus({ orderNumber, to: 'SHIPPING', actorId: adminId, isAdmin: true });

            await expect(admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: adminId, isAdmin: true })).rejects.toThrow();
            expect(await stockOf(skuFirst)).toBe(STOCK - 2);
      });
});

describe('khách tự huỷ đơn', () => {
      test('huỷ được đơn của mình khi còn chờ xác nhận', async () => {
            const { orderNumber, userId } = await placeOrder(2);

            await admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: userId, isAdmin: false });

            expect(await statusOf(orderNumber)).toBe('CANCELLED');
            expect(await stockOf(skuFirst)).toBe(STOCK);
      });

      test('không huỷ được sau khi shop đã xác nhận', async () => {
            const { orderNumber, userId } = await placeOrder();
            const adminId = await createUser('ADMIN');
            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });

            const failure = await admin
                  .changeStatus({ orderNumber, to: 'CANCELLED', actorId: userId, isAdmin: false })
                  .catch((error: unknown) => error);

            expect((failure as DomainException).details).toMatchObject({ reason: 'INVALID_TRANSITION' });
            expect(await statusOf(orderNumber)).toBe('CONFIRMED');
      });

      test('không huỷ được đơn của người khác, và nhận không tìm thấy', async () => {
            // Trả 403 là xác nhận mã đơn đó có thật.
            const { orderNumber } = await placeOrder();
            const stranger = await createUser();

            await expect(admin.changeStatus({ orderNumber, to: 'CANCELLED', actorId: stranger, isAdmin: false })).rejects.toMatchObject({
                  status: 404,
            });
      });

      test('khách không tự xác nhận được đơn của mình', async () => {
            const { orderNumber, userId } = await placeOrder();

            await expect(admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: userId, isAdmin: false })).rejects.toThrow();
      });
});

describe('trạng thái thanh toán', () => {
      test('đánh dấu đã thu tiền và ghi lịch sử', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changePaymentStatus(orderNumber, 'PAID', adminId, 'Thu đủ khi giao');

            const history = await admin.historyOf(orderNumber);
            expect(history[0]).toMatchObject({ kind: 'PAYMENT', from: 'UNPAID', to: 'PAID', note: 'Thu đủ khi giao' });
      });

      test('đánh dấu lại cùng trạng thái bị từ chối và không sinh dòng lịch sử thứ hai', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changePaymentStatus(orderNumber, 'PAID', adminId);
            await admin.changePaymentStatus(orderNumber, 'PAID', adminId).catch(() => undefined);

            expect(await admin.historyOf(orderNumber)).toHaveLength(1);
      });

      test('lịch sử đơn gồm cả thay đổi trạng thái lẫn thay đổi thanh toán, theo thứ tự thời gian', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });
            await admin.changePaymentStatus(orderNumber, 'PAID', adminId);

            const history = await admin.historyOf(orderNumber);
            expect(history.map((entry) => entry.kind)).toEqual(['STATUS', 'PAYMENT']);
      });
});

describe('danh sách đơn cho quản trị viên', () => {
      test('lọc theo trạng thái', async () => {
            const first = await placeOrder(1);
            await placeOrder(1);
            const adminId = await createUser('ADMIN');

            await admin.changeStatus({ orderNumber: first.orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });

            const result = await admin.list({ status: 'CONFIRMED', page: 1 });
            expect(result.total).toBe(1);
            expect(result.items[0].orderNumber).toBe(first.orderNumber);
      });

      test('tìm theo mã đơn', async () => {
            const { orderNumber } = await placeOrder(1);
            await placeOrder(1);

            const result = await admin.list({ search: orderNumber, page: 1 });
            expect(result.total).toBe(1);
      });

      test('tìm theo số điện thoại người nhận', async () => {
            await placeOrder(1);

            const result = await admin.list({ search: '0912345678', page: 1 });
            expect(result.total).toBe(1);
            expect(result.items[0].recipientPhone).toBe('0912345678');
      });

      test('từ khoá không khớp thì trả về rỗng', async () => {
            await placeOrder(1);

            expect((await admin.list({ search: '0900000000', page: 1 })).total).toBe(0);
      });

      test('đơn mới nhất lên trước', async () => {
            const first = await placeOrder(1);
            const second = await placeOrder(1);

            const result = await admin.list({ page: 1 });
            expect(result.items.map((item) => item.orderNumber)).toEqual([second.orderNumber, first.orderNumber]);
      });

      test('phân trang và tổng số đơn không phụ thuộc trang đang xem', async () => {
            for (let index = 0; index < 3; index += 1) {
                  await placeOrder(1);
            }

            const page = await admin.list({ page: 2 });
            expect(page.total).toBe(3);
            expect(page.items).toHaveLength(0);
      });

      test('lọc theo khoảng ngày loại bỏ đơn ngoài khoảng', async () => {
            await placeOrder(1);

            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            expect((await admin.list({ from: tomorrow, page: 1 })).total).toBe(0);
      });
});

describe('chi tiết đơn kèm lịch sử', () => {
      test('nêu đúng những bước chuyển hợp lệ cho quản trị viên', async () => {
            const { orderNumber } = await placeOrder();
            const adminId = await createUser('ADMIN');

            const detail = await admin.detail(orderNumber, { id: adminId, isAdmin: true });
            expect(detail.allowedTransitions).toEqual(['CONFIRMED', 'CANCELLED']);
      });

      test('khách chỉ thấy bước huỷ, và chỉ khi đơn còn chờ xác nhận', async () => {
            const { orderNumber, userId } = await placeOrder();

            expect((await admin.detail(orderNumber, { id: userId, isAdmin: false })).allowedTransitions).toEqual(['CANCELLED']);

            const adminId = await createUser('ADMIN');
            await admin.changeStatus({ orderNumber, to: 'CONFIRMED', actorId: adminId, isAdmin: true });

            expect((await admin.detail(orderNumber, { id: userId, isAdmin: false })).allowedTransitions).toEqual([]);
      });

      test('khách khác không đọc được chi tiết đơn', async () => {
            const { orderNumber } = await placeOrder();
            const stranger = await createUser();

            await expect(admin.detail(orderNumber, { id: stranger, isAdmin: false })).rejects.toMatchObject({ status: 404 });
      });
});

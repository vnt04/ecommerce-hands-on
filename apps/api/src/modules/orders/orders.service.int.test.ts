import type { ShippingInfo } from '@shopflow/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { OrdersService } from './orders.service.js';

const PRICE = 299_000n;
const STOCK = 5;

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
let carts: CartService;
let catalog: CatalogService;

let skuFirst: string;
let skuLast: string;

async function seedCatalog(): Promise<void> {
      const category = await prisma.category.create({ data: { slug: 'ao-thun', name: 'Áo thun' }, select: { id: true } });
      const black = await prisma.color.create({ data: { code: 'BLK', name: 'Đen', hexCode: '#000000' }, select: { id: true } });
      const white = await prisma.color.create({ data: { code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF' }, select: { id: true } });
      const small = await prisma.size.create({ data: { name: 'S', sortOrder: 1 }, select: { id: true } });
      const medium = await prisma.size.create({ data: { name: 'M', sortOrder: 2 }, select: { id: true } });

      const result = await catalog.createProductWithMatrix({
            categoryId: category.id,
            designCode: 'TSA001',
            slug: 'ao-thun-basic',
            name: 'Áo thun basic',
            colorIds: [black.id, white.id],
            sizeIds: [small.id, medium.id],
            defaultPrice: PRICE,
            defaultStockQuantity: STOCK,
      });

      await prisma.product.update({ where: { id: result.productId }, data: { status: 'PUBLISHED' } });

      const variants = await prisma.productVariant.findMany({
            where: { productId: result.productId },
            orderBy: { sku: 'asc' },
            select: { sku: true },
      });

      skuFirst = variants[0].sku;
      skuLast = variants[variants.length - 1].sku;
}

let userSequence = 0;

async function createUser(): Promise<bigint> {
      userSequence += 1;

      const user = await prisma.user.create({
            data: { email: 'khach' + userSequence + '@example.com', passwordHash: 'x', fullName: 'Khách ' + userSequence },
            select: { id: true },
      });

      return user.id;
}

/** Dựng một tài khoản đã có sẵn giỏ chứa một dòng, trạng thái sẵn sàng đặt hàng. */
async function userWithCart(sku: string, quantity: number): Promise<{ userId: bigint }> {
      const userId = await createUser();
      const cartId = (await carts.findOrCreate({ userId })).id;

      await carts.addItem(cartId, sku, quantity);

      return { userId };
}

function keyOf(label: string): string {
      return 'idem-key-' + label + '-0123456789';
}

beforeAll(() => {
      prisma = createTestPrismaClient();
      orders = new OrdersService(prisma as unknown as PrismaService);
      carts = new CartService(prisma as unknown as PrismaService);
      catalog = new CatalogService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await prisma.$executeRawUnsafe(
            'TRUNCATE idempotency_keys, order_items, orders, order_number_counters, refresh_tokens, users RESTART IDENTITY CASCADE',
      );
      await resetDatabase(prisma);
      await seedCatalog();
});

describe('placeOrder', () => {
      test('tạo đơn với mã theo ADR-002 và tổng tiền bằng tổng các dòng', async () => {
            const { userId } = await userWithCart(skuFirst, 2);

            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            expect(order.orderNumber).toMatch(/^SF-\d{6}-\d{4}$/);
            expect(order.lines).toHaveLength(1);
            expect(order.lines[0]).toMatchObject({ sku: skuFirst, quantity: 2, unitPrice: '299000', lineTotal: '598000' });
            expect(order.subtotal).toBe('598000');
            expect(order.total).toBe('598000');
            expect(order.status).toBe('PENDING');
            expect(order.paymentMethod).toBe('COD');
            expect(order.paymentStatus).toBe('UNPAID');
      });

      test('trừ đúng số lượng khỏi tồn kho', async () => {
            const { userId } = await userWithCart(skuFirst, 2);

            await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: skuFirst }, select: { stockQuantity: true } });
            expect(variant.stockQuantity).toBe(STOCK - 2);
      });

      test('xoá giỏ sau khi đơn hình thành', async () => {
            const { userId } = await userWithCart(skuFirst, 1);

            await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            expect(await carts.findId({ userId })).toBeNull();
      });

      test('chép thông tin giao hàng vào đơn', async () => {
            const { userId } = await userWithCart(skuFirst, 1);

            const order = await orders.placeOrder({
                  userId,
                  shipping: { ...SHIPPING, note: 'Giao giờ hành chính' },
                  idempotencyKey: keyOf('a'),
            });

            expect(order.shipping).toMatchObject({ recipientName: 'Nguyễn Văn A', recipientPhone: '0912345678' });
            expect(order.shipping.note).toBe('Giao giờ hành chính');
      });

      test('nhiều dòng thì tổng bằng tổng các dòng', async () => {
            const userId = await createUser();
            const cartId = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(cartId, skuFirst, 2);
            await carts.addItem(cartId, skuLast, 1);

            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            expect(order.lines).toHaveLength(2);
            expect(order.subtotal).toBe('897000');
            expect(order.itemCount).toBe(3);
      });
});

describe('chốt giá tại thời điểm đặt (R4)', () => {
      test('đổi giá biến thể sau khi đặt không làm đổi tổng tiền của đơn cũ', async () => {
            const { userId } = await userWithCart(skuFirst, 2);
            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { price: 500_000n } });

            const reloaded = await orders.findByNumber(order.orderNumber, userId);
            expect(reloaded.total).toBe('598000');
            expect(reloaded.lines[0].unitPrice).toBe('299000');
      });

      test('đổi tên sản phẩm sau khi đặt không làm đổi dòng đơn cũ', async () => {
            const { userId } = await userWithCart(skuFirst, 1);
            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            await prisma.product.updateMany({ data: { name: 'Tên hoàn toàn khác' } });

            const reloaded = await orders.findByNumber(order.orderNumber, userId);
            expect(reloaded.lines[0].productName).toBe('Áo thun basic');
      });
});

describe('chống trùng đơn (R3)', () => {
      test('gửi lại cùng khoá trả về đúng đơn cũ, không tạo đơn thứ hai', async () => {
            const { userId } = await userWithCart(skuFirst, 2);
            const key = keyOf('a');

            const first = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key });
            const second = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key });

            expect(second.orderNumber).toBe(first.orderNumber);
            expect(await prisma.order.count()).toBe(1);
      });

      test('gửi lại cùng khoá không trừ tồn lần hai', async () => {
            const { userId } = await userWithCart(skuFirst, 2);
            const key = keyOf('a');

            await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key });
            await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key });

            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: skuFirst }, select: { stockQuantity: true } });
            expect(variant.stockQuantity).toBe(STOCK - 2);
      });

      test('hai yêu cầu đồng thời cùng khoá chỉ sinh một đơn', async () => {
            const { userId } = await userWithCart(skuFirst, 1);
            const key = keyOf('a');
            const request = { userId, shipping: SHIPPING, idempotencyKey: key };

            const results = await Promise.allSettled([orders.placeOrder(request), orders.placeOrder(request)]);

            expect(await prisma.order.count()).toBe(1);

            // Yêu cầu thứ hai hoặc trả về đúng đơn đó, hoặc báo đang xử lý. Cả hai đều
            // đúng; điều không được phép là tạo đơn thứ hai.
            const fulfilled = results.filter((result) => result.status === 'fulfilled');
            expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      });

      test('khoá khác nhau trên hai giỏ khác nhau tạo hai đơn', async () => {
            const first = await userWithCart(skuFirst, 1);
            const second = await userWithCart(skuFirst, 1);

            await orders.placeOrder({ ...first, shipping: SHIPPING, idempotencyKey: keyOf('a') });
            await orders.placeOrder({ ...second, shipping: SHIPPING, idempotencyKey: keyOf('b') });

            expect(await prisma.order.count()).toBe(2);
      });
});

describe('không bán vượt tồn (R2)', () => {
      test('xin nhiều hơn tồn thì bị từ chối và nêu rõ SKU cùng số còn lại', async () => {
            const { userId } = await userWithCart(skuFirst, STOCK);
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: 1 } });

            const failure = await orders
                  .placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') })
                  .catch((error: unknown) => error);

            expect(failure).toBeInstanceOf(DomainException);
            expect((failure as DomainException).details).toMatchObject({
                  reason: 'OUT_OF_STOCK',
                  sku: skuFirst,
                  availableQuantity: 1,
            });
      });

      test('đơn bị từ chối thì không trừ tồn và không xoá giỏ', async () => {
            const { userId } = await userWithCart(skuFirst, STOCK);
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: 1 } });

            await expect(orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') })).rejects.toThrow();

            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: skuFirst }, select: { stockQuantity: true } });
            expect(variant.stockQuantity).toBe(1);
            expect(await carts.findId({ userId })).not.toBeNull();
      });

      test('đơn bị từ chối thì khoá chống trùng cũng bị nhả, gửi lại được', async () => {
            const { userId } = await userWithCart(skuFirst, STOCK);
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: 0 } });

            const key = keyOf('a');
            await expect(orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key })).rejects.toThrow();

            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: STOCK } });

            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: key });
            expect(order.lines[0].quantity).toBe(STOCK);
      });

      /**
       * Đây là test quan trọng nhất của S08.
       *
       * Kho còn đúng một chiếc, hai mươi đơn cùng lao vào. Nếu việc kiểm tồn và việc
       * trừ tồn không phải là một thao tác thì nhiều hơn một đơn sẽ thành công, và
       * tồn kho xuống số âm.
       */
      test('kho còn 1, hai mươi yêu cầu đồng thời: đúng một đơn thành công', async () => {
            const CONCURRENT = 20;
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: 1 } });

            const buyers = await Promise.all(Array.from({ length: CONCURRENT }, () => userWithCart(skuFirst, 1)));

            const results = await Promise.allSettled(
                  buyers.map((buyer, index) => orders.placeOrder({ ...buyer, shipping: SHIPPING, idempotencyKey: keyOf('buyer' + index) })),
            );

            const succeeded = results.filter((result) => result.status === 'fulfilled');
            expect(succeeded).toHaveLength(1);
            expect(await prisma.order.count()).toBe(1);

            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: skuFirst }, select: { stockQuantity: true } });
            expect(variant.stockQuantity).toBe(0);
      });
});

describe('từ chối đơn không hợp lệ', () => {
      test('giỏ rỗng thì không đặt được', async () => {
            const userId = await createUser();
            // Giỏ tồn tại nhưng không có dòng nào — khác với chưa từng có giỏ.
            await carts.findOrCreate({ userId });

            const failure = await orders
                  .placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') })
                  .catch((error: unknown) => error);

            expect((failure as DomainException).details).toMatchObject({ reason: 'CART_EMPTY' });
      });

      test('sản phẩm đã tắt thì không đặt được và nêu rõ SKU', async () => {
            const { userId } = await userWithCart(skuFirst, 1);
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { isActive: false } });

            const failure = await orders
                  .placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') })
                  .catch((error: unknown) => error);

            expect((failure as DomainException).details).toMatchObject({ reason: 'NOT_SELLABLE', sku: skuFirst });
      });

      test('sản phẩm rời khỏi trạng thái xuất bản thì không đặt được', async () => {
            const { userId } = await userWithCart(skuFirst, 1);
            await prisma.product.updateMany({ data: { status: 'DRAFT' } });

            await expect(orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') })).rejects.toThrow();
      });
});

describe('mã đơn', () => {
      test('hai đơn trong cùng ngày nhận số thứ tự liên tiếp', async () => {
            const first = await userWithCart(skuFirst, 1);
            const second = await userWithCart(skuFirst, 1);

            const a = await orders.placeOrder({ ...first, shipping: SHIPPING, idempotencyKey: keyOf('a') });
            const b = await orders.placeOrder({ ...second, shipping: SHIPPING, idempotencyKey: keyOf('b') });

            expect(a.orderNumber.slice(-4)).toBe('0001');
            expect(b.orderNumber.slice(-4)).toBe('0002');
      });

      test('mười đơn đồng thời nhận mười mã khác nhau, không trùng và không trống', async () => {
            const CONCURRENT = 10;
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: CONCURRENT } });

            const buyers = await Promise.all(Array.from({ length: CONCURRENT }, () => userWithCart(skuFirst, 1)));

            const results = await Promise.all(
                  buyers.map((buyer, index) => orders.placeOrder({ ...buyer, shipping: SHIPPING, idempotencyKey: keyOf('buyer' + index) })),
            );

            const numbers = results.map((order) => order.orderNumber);
            expect(new Set(numbers).size).toBe(CONCURRENT);
            expect(numbers.map((number) => Number(number.slice(-4))).sort((a, b) => a - b)).toEqual(
                  Array.from({ length: CONCURRENT }, (_, index) => index + 1),
            );
      });
});

describe('xem lại đơn', () => {
      test('chủ đơn xem được đơn của mình', async () => {
            const { userId } = await userWithCart(skuFirst, 1);
            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            expect((await orders.findByNumber(order.orderNumber, userId)).orderNumber).toBe(order.orderNumber);
      });

      test('tài khoản khác nhận không tìm thấy chứ không phải không có quyền', async () => {
            // Trả 403 là xác nhận mã đơn đó có thật, và mã đơn có thể dò được.
            const { userId } = await userWithCart(skuFirst, 1);
            const order = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });
            const stranger = await createUser();

            await expect(orders.findByNumber(order.orderNumber, stranger)).rejects.toMatchObject({ status: 404 });
      });

      test('danh sách đơn xếp đơn mới nhất lên trước', async () => {
            const userId = await createUser();

            const cartA = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(cartA, skuFirst, 1);
            const first = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('a') });

            const cartB = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(cartB, skuLast, 1);
            const second = await orders.placeOrder({ userId, shipping: SHIPPING, idempotencyKey: keyOf('b') });

            const list = await orders.listForUser(userId);
            expect(list.map((order) => order.orderNumber)).toEqual([second.orderNumber, first.orderNumber]);
      });

      test('danh sách không lẫn đơn của tài khoản khác', async () => {
            const mine = await userWithCart(skuFirst, 1);
            const theirs = await userWithCart(skuFirst, 1);

            await orders.placeOrder({ ...mine, shipping: SHIPPING, idempotencyKey: keyOf('a') });
            await orders.placeOrder({ ...theirs, shipping: SHIPPING, idempotencyKey: keyOf('b') });

            expect(await orders.listForUser(mine.userId)).toHaveLength(1);
      });
});

describe('ràng buộc cơ sở dữ liệu', () => {
      test('tồn kho không xuống được số âm dù ghi thẳng vào database', async () => {
            // Chốt chặn cuối cùng của R2: kể cả khi mã trừ tồn có lỗi.
            await expect(prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: -1 } })).rejects.toThrow();
      });

      test('tổng của đơn phải bằng tổng tiền hàng cộng phí vận chuyển', async () => {
            const userId = await createUser();

            await expect(
                  prisma.order.create({
                        data: {
                              userId,
                              orderNumber: 'SF-260819-9999',
                              paymentMethod: 'COD',
                              recipientName: 'A',
                              recipientPhone: '0912345678',
                              addressLine: '12 Nguyễn Huệ',
                              ward: 'Bến Nghé',
                              district: 'Quận 1',
                              province: 'TP Hồ Chí Minh',
                              subtotal: 100_000n,
                              shippingFee: 0n,
                              total: 999_999n,
                        },
                  }),
            ).rejects.toThrow();
      });
});

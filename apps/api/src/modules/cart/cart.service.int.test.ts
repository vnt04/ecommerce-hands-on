import { ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { CartService } from './cart.service.js';

const PRICE = 299_000n;
const STOCK = 5;

let prisma: TestPrismaClient;
let carts: CartService;
let catalog: CatalogService;

/** SKU của hai tổ hợp khác nhau, do bước tạo ma trận sinh ra. Xem domain/sku.ts. */
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

async function newAnonymousCart(token: string): Promise<bigint> {
      return (await carts.findOrCreate({ token })).id;
}

async function createUser(): Promise<bigint> {
      const user = await prisma.user.create({
            data: { email: 'khach@example.com', passwordHash: 'x', fullName: 'Khách' },
            select: { id: true },
      });

      return user.id;
}

beforeAll(() => {
      prisma = createTestPrismaClient();
      carts = new CartService(prisma as unknown as PrismaService);
      catalog = new CatalogService(prisma as unknown as PrismaService);
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await prisma.$executeRawUnsafe('TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE');
      await resetDatabase(prisma);
      await seedCatalog();
});

describe('findOrCreate', () => {
      test('trả về cùng một giỏ khi gọi lại với cùng mã ẩn danh', async () => {
            const first = await carts.findOrCreate({ token: 'token-a' });
            const second = await carts.findOrCreate({ token: 'token-a' });

            expect(second.id).toBe(first.id);
      });

      test('mỗi tài khoản chỉ có một giỏ', async () => {
            const userId = await createUser();

            const first = await carts.findOrCreate({ userId });
            const second = await carts.findOrCreate({ userId });

            expect(second.id).toBe(first.id);
            expect(await prisma.cart.count()).toBe(1);
      });

      test('findId không tạo giỏ mới', async () => {
            expect(await carts.findId({ token: 'chua-ton-tai' })).toBeNull();
            expect(await prisma.cart.count()).toBe(0);
      });
});

describe('addItem', () => {
      test('thêm hàng trả về dòng kèm giá hiện tại và tổng tạm tính', async () => {
            const cartId = await newAnonymousCart('token-a');

            const result = await carts.addItem(cartId, skuFirst, 2);

            expect(result.adjustedQuantity).toBeUndefined();
            expect(result.cart.lines).toHaveLength(1);
            expect(result.cart.lines[0]).toMatchObject({ sku: skuFirst, quantity: 2, unitPrice: '299000', lineTotal: '598000' });
            expect(result.cart.subtotal).toBe('598000');
            expect(result.cart.itemCount).toBe(2);
      });

      test('thêm lại cùng SKU thì cộng dồn chứ không sinh dòng mới', async () => {
            const cartId = await newAnonymousCart('token-a');

            await carts.addItem(cartId, skuFirst, 1);
            const result = await carts.addItem(cartId, skuFirst, 2);

            expect(result.cart.lines).toHaveLength(1);
            expect(result.cart.lines[0].quantity).toBe(3);
      });

      test('số lượng vượt tồn bị chặn xuống bằng tồn và kết quả nêu số thực nhận', async () => {
            const cartId = await newAnonymousCart('token-a');

            const result = await carts.addItem(cartId, skuFirst, STOCK + 10);

            expect(result.adjustedQuantity).toBe(STOCK);
            expect(result.cart.lines[0].quantity).toBe(STOCK);
      });

      test('SKU không tồn tại thì báo không tìm thấy', async () => {
            const cartId = await newAnonymousCart('token-a');

            await expect(carts.addItem(cartId, 'KHONG-CO', 1)).rejects.toBeInstanceOf(NotFoundException);
      });

      test('sản phẩm chưa xuất bản thì không thêm được', async () => {
            const cartId = await newAnonymousCart('token-a');
            await prisma.product.updateMany({ data: { status: 'DRAFT' } });

            await expect(carts.addItem(cartId, skuFirst, 1)).rejects.toBeInstanceOf(ConflictException);
      });

      test('tổ hợp đã tắt thì không thêm được', async () => {
            const cartId = await newAnonymousCart('token-a');
            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { isActive: false } });

            await expect(carts.addItem(cartId, skuFirst, 1)).rejects.toBeInstanceOf(ConflictException);
      });
});

describe('updateQuantity', () => {
      test('đổi số lượng thì tổng tạm tính đổi theo', async () => {
            const cartId = await newAnonymousCart('token-a');
            await carts.addItem(cartId, skuFirst, 1);

            const result = await carts.updateQuantity(cartId, skuFirst, 3);

            expect(result.cart.lines[0].quantity).toBe(3);
            expect(result.cart.subtotal).toBe('897000');
      });

      test('đặt về 0 thì dòng biến mất', async () => {
            const cartId = await newAnonymousCart('token-a');
            await carts.addItem(cartId, skuFirst, 2);

            const result = await carts.updateQuantity(cartId, skuFirst, 0);

            expect(result.cart.lines).toHaveLength(0);
            expect(result.cart.subtotal).toBe('0');
      });

      test('dòng không có trong giỏ thì báo không tìm thấy', async () => {
            const cartId = await newAnonymousCart('token-a');

            await expect(carts.updateQuantity(cartId, skuFirst, 1)).rejects.toBeInstanceOf(NotFoundException);
      });
});

describe('view', () => {
      test('giá đổi sau khi thêm thì giỏ hiện giá mới và đánh dấu đã đổi', async () => {
            const cartId = await newAnonymousCart('token-a');
            await carts.addItem(cartId, skuFirst, 1);

            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { price: 350_000n } });
            const cart = await carts.view(cartId);

            expect(cart.lines[0].unitPrice).toBe('350000');
            expect(cart.lines[0].hasPriceChanged).toBe(true);
            expect(cart.subtotal).toBe('350000');
      });

      test('hết hàng sau khi thêm thì dòng vẫn còn nhưng bị đánh dấu', async () => {
            const cartId = await newAnonymousCart('token-a');
            await carts.addItem(cartId, skuFirst, 2);

            await prisma.productVariant.update({ where: { sku: skuFirst }, data: { stockQuantity: 0 } });
            const cart = await carts.view(cartId);

            expect(cart.lines[0].isOutOfStock).toBe(true);
            expect(cart.lines[0].availableQuantity).toBe(0);
      });
});

describe('mergeAnonymousCart', () => {
      test('cùng SKU thì cộng số lượng và giỏ ẩn danh bị xoá', async () => {
            const userId = await createUser();
            const anonymousId = await newAnonymousCart('token-a');
            await carts.addItem(anonymousId, skuFirst, 2);

            const accountId = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(accountId, skuFirst, 1);

            await carts.mergeAnonymousCart('token-a', userId);

            const cart = await carts.view(accountId);
            expect(cart.lines).toHaveLength(1);
            expect(cart.lines[0].quantity).toBe(3);
            expect(await prisma.cart.findUnique({ where: { token: 'token-a' } })).toBeNull();
      });

      test('SKU khác nhau thì gộp thành nhiều dòng', async () => {
            const userId = await createUser();
            const anonymousId = await newAnonymousCart('token-a');
            await carts.addItem(anonymousId, skuLast, 1);

            const accountId = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(accountId, skuFirst, 1);

            await carts.mergeAnonymousCart('token-a', userId);

            expect((await carts.view(accountId)).lines).toHaveLength(2);
      });

      test('tổng sau khi gộp vẫn bị chặn trần theo tồn', async () => {
            const userId = await createUser();
            const anonymousId = await newAnonymousCart('token-a');
            await carts.addItem(anonymousId, skuFirst, STOCK);

            const accountId = (await carts.findOrCreate({ userId })).id;
            await carts.addItem(accountId, skuFirst, STOCK);

            await carts.mergeAnonymousCart('token-a', userId);

            expect((await carts.view(accountId)).lines[0].quantity).toBe(STOCK);
      });

      test('chưa từng có giỏ ẩn danh thì không có gì xảy ra', async () => {
            const userId = await createUser();

            await expect(carts.mergeAnonymousCart('khong-ton-tai', userId)).resolves.toBeUndefined();
      });

      test('tài khoản chưa có giỏ thì nhận nguyên giỏ ẩn danh', async () => {
            const userId = await createUser();
            const anonymousId = await newAnonymousCart('token-a');
            await carts.addItem(anonymousId, skuFirst, 2);

            await carts.mergeAnonymousCart('token-a', userId);

            const accountId = await carts.findId({ userId });
            expect(accountId).not.toBeNull();
            expect((await carts.view(accountId as bigint)).lines[0].quantity).toBe(2);
      });
});

describe('ràng buộc cơ sở dữ liệu', () => {
      test('một giỏ không thể vừa thuộc tài khoản vừa có mã ẩn danh', async () => {
            const userId = await createUser();

            await expect(prisma.cart.create({ data: { userId, token: 'token-a', expiresAt: new Date() } })).rejects.toThrow();
      });

      test('số lượng không dương bị chặn ở tầng cơ sở dữ liệu', async () => {
            const cartId = await newAnonymousCart('token-a');
            const variant = await prisma.productVariant.findUniqueOrThrow({ where: { sku: skuFirst }, select: { id: true } });

            await expect(
                  prisma.cartItem.create({ data: { cartId, variantId: variant.id, quantity: 0, priceWhenAdded: PRICE } }),
            ).rejects.toThrow();
      });
});

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { vndToJson, type CartLine, type CartMutationResult, type CartView } from '@shopflow/shared';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service.js';

const CART_TOKEN_BYTES = 24;
const CART_TTL_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type CartIdentity = { userId?: bigint; token?: string };

function expiryFromNow(): Date {
      return new Date(Date.now() + CART_TTL_DAYS * MILLISECONDS_PER_DAY);
}

export function generateCartToken(): string {
      return randomBytes(CART_TOKEN_BYTES).toString('base64url');
}

@Injectable()
export class CartService {
      constructor(private readonly prisma: PrismaService) {}

      /** Tìm giỏ theo danh tính, trả về null nếu chưa có. Không tạo mới. */
      async findId(identity: CartIdentity): Promise<bigint | null> {
            const cart = await this.prisma.cart.findFirst({ where: this.whereOf(identity), select: { id: true } });

            return cart?.id ?? null;
      }

      /**
       * Tìm giỏ theo danh tính, tạo mới nếu chưa có.
       *
       * Khách chưa đăng nhập vẫn có giỏ đầy đủ: bắt đăng nhập trước khi xem giỏ là
       * cách nhanh nhất để mất khách.
       */
      async findOrCreate(identity: CartIdentity): Promise<{ id: bigint }> {
            const existing = await this.prisma.cart.findFirst({ where: this.whereOf(identity), select: { id: true } });

            if (existing !== null) {
                  return existing;
            }

            return this.prisma.cart.create({
                  data: {
                        userId: identity.userId,
                        token: identity.userId === undefined ? identity.token : null,
                        expiresAt: expiryFromNow(),
                  },
                  select: { id: true },
            });
      }

      async view(cartId: bigint): Promise<CartView> {
            const items = await this.prisma.cartItem.findMany({
                  where: { cartId },
                  orderBy: { id: 'asc' },
                  select: {
                        quantity: true,
                        priceWhenAdded: true,
                        variant: {
                              select: {
                                    sku: true,
                                    price: true,
                                    stockQuantity: true,
                                    product: { select: { slug: true, name: true } },
                                    color: { select: { name: true } },
                                    size: { select: { name: true } },
                              },
                        },
                  },
            });

            let subtotal = 0n;

            const lines = items.map((item): CartLine => {
                  const lineTotal = item.variant.price * BigInt(item.quantity);
                  subtotal += lineTotal;

                  return {
                        sku: item.variant.sku,
                        productSlug: item.variant.product.slug,
                        productName: item.variant.product.name,
                        colorName: item.variant.color.name,
                        sizeName: item.variant.size.name,
                        quantity: item.quantity,
                        // Giỏ hiển thị giá hiện tại, không phải giá lúc thêm. Giá chỉ
                        // được chốt cứng khi đơn hàng hình thành (ràng buộc R4).
                        unitPrice: vndToJson(item.variant.price),
                        lineTotal: vndToJson(lineTotal),
                        availableQuantity: item.variant.stockQuantity,
                        isOutOfStock: item.variant.stockQuantity === 0,
                        hasPriceChanged: item.variant.price !== item.priceWhenAdded,
                  };
            });

            return {
                  lines,
                  subtotal: vndToJson(subtotal),
                  itemCount: lines.reduce((total, line) => total + line.quantity, 0),
            };
      }

      /**
       * Thêm một biến thể vào giỏ. Thêm lại cùng SKU thì cộng dồn.
       *
       * Số lượng bị chặn trần theo tồn hiện có và kết quả nêu rõ số thực nhận:
       * khách vẫn mua được phần còn hàng thay vì bị từ chối trắng, nhưng phải biết
       * là mình nhận ít hơn số đã xin.
       *
       * Trần này chỉ đúng tại thời điểm thêm. Giỏ không giữ chỗ — bước đặt hàng mới
       * là nơi kiểm lần cuối và trừ tồn trong cùng transaction.
       */
      async addItem(cartId: bigint, sku: string, quantity: number): Promise<CartMutationResult> {
            const variant = await this.findSellableVariant(sku);

            const existing = await this.prisma.cartItem.findUnique({
                  where: { cartId_variantId: { cartId, variantId: variant.id } },
                  select: { quantity: true },
            });

            const requested = (existing?.quantity ?? 0) + quantity;
            const accepted = Math.min(requested, variant.stockQuantity);

            await this.prisma.cartItem.upsert({
                  where: { cartId_variantId: { cartId, variantId: variant.id } },
                  update: { quantity: accepted },
                  create: { cartId, variantId: variant.id, quantity: accepted, priceWhenAdded: variant.price },
            });

            return {
                  cart: await this.view(cartId),
                  adjustedQuantity: accepted < requested ? accepted : undefined,
            };
      }

      async updateQuantity(cartId: bigint, sku: string, quantity: number): Promise<CartMutationResult> {
            const variant = await this.findSellableVariant(sku);
            const accepted = Math.min(quantity, variant.stockQuantity);

            if (accepted <= 0) {
                  await this.removeItem(cartId, sku);

                  return { cart: await this.view(cartId), adjustedQuantity: 0 };
            }

            const updated = await this.prisma.cartItem.updateMany({
                  where: { cartId, variantId: variant.id },
                  data: { quantity: accepted },
            });

            if (updated.count === 0) {
                  throw new NotFoundException('Không có dòng này trong giỏ');
            }

            return {
                  cart: await this.view(cartId),
                  adjustedQuantity: accepted < quantity ? accepted : undefined,
            };
      }

      async removeItem(cartId: bigint, sku: string): Promise<CartView> {
            await this.prisma.cartItem.deleteMany({ where: { cartId, variant: { sku } } });

            return this.view(cartId);
      }

      /**
       * Gộp giỏ ẩn danh vào giỏ của tài khoản khi đăng nhập.
       *
       * Cùng SKU thì cộng số lượng, vẫn chặn trần theo tồn. Giỏ ẩn danh bị xoá sau
       * khi gộp để không còn hai giỏ cùng tồn tại.
       *
       * Chạy trong một transaction: gộp có thể trùng thời điểm với một thao tác
       * thêm hàng, và ràng buộc duy nhất trên cặp giỏ và biến thể là thứ giữ cho
       * không sinh dòng trùng.
       */
      async mergeAnonymousCart(token: string, userId: bigint): Promise<void> {
            const anonymous = await this.prisma.cart.findUnique({
                  where: { token },
                  select: { id: true, items: { select: { variantId: true, quantity: true, priceWhenAdded: true } } },
            });

            if (anonymous === null || anonymous.items.length === 0) {
                  await this.prisma.cart.deleteMany({ where: { token } });

                  return;
            }

            const target = await this.findOrCreate({ userId });

            const variants = await this.prisma.productVariant.findMany({
                  where: { id: { in: anonymous.items.map((item) => item.variantId) } },
                  select: { id: true, stockQuantity: true },
            });
            const stockByVariant = new Map(variants.map((variant) => [variant.id, variant.stockQuantity]));

            await this.prisma.$transaction(async (tx) => {
                  for (const item of anonymous.items) {
                        const existing = await tx.cartItem.findUnique({
                              where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
                              select: { quantity: true },
                        });

                        const stock = stockByVariant.get(item.variantId) ?? 0;
                        const merged = Math.min((existing?.quantity ?? 0) + item.quantity, stock);

                        if (merged <= 0) {
                              continue;
                        }

                        await tx.cartItem.upsert({
                              where: { cartId_variantId: { cartId: target.id, variantId: item.variantId } },
                              update: { quantity: merged },
                              create: {
                                    cartId: target.id,
                                    variantId: item.variantId,
                                    quantity: merged,
                                    priceWhenAdded: item.priceWhenAdded,
                              },
                        });
                  }

                  await tx.cart.delete({ where: { id: anonymous.id } });
            });
      }

      private whereOf(identity: CartIdentity): { userId: bigint } | { token: string | undefined } {
            return identity.userId === undefined ? { token: identity.token } : { userId: identity.userId };
      }

      private async findSellableVariant(sku: string): Promise<{ id: bigint; price: bigint; stockQuantity: number }> {
            const variant = await this.prisma.productVariant.findUnique({
                  where: { sku },
                  select: {
                        id: true,
                        price: true,
                        stockQuantity: true,
                        isActive: true,
                        product: { select: { status: true, archivedAt: true } },
                  },
            });

            if (variant === null) {
                  throw new NotFoundException('Không tìm thấy sản phẩm: ' + sku);
            }

            // Tổ hợp đã tắt hoặc thiết kế đã lưu trữ thì không bán nữa, kể cả khi
            // khách còn giữ đường dẫn cũ.
            if (!variant.isActive || variant.product.archivedAt !== null || variant.product.status !== 'PUBLISHED') {
                  throw new ConflictException('Sản phẩm này hiện không bán');
            }

            return { id: variant.id, price: variant.price, stockQuantity: variant.stockQuantity };
      }
}

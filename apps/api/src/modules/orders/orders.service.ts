import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { vndToJson, type OrderDetail, type OrderLine, type OrderSummary, type ShippingInfo } from '@shopflow/shared';

import { DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { formatOrderNumber, vietnamDayOf } from './domain/order-number.js';

/** Khoá chống trùng giữ trong 24 giờ. Đủ dài cho mọi lần thử lại hợp lý của client. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Transaction đặt hàng có thể phải xếp hàng sau vài đơn khác cùng tranh một biến thể.
 * Mười giây rộng hơn nhiều so với thời gian thực tế, nhưng vẫn đủ ngắn để một
 * transaction kẹt không giữ khoá vô hạn.
 */
const TRANSACTION_TIMEOUT_MS = 10_000;

/** Mã lỗi Prisma cho vi phạm ràng buộc duy nhất. */
const UNIQUE_VIOLATION = 'P2002';

export type PlaceOrderInput = {
      userId: bigint;
      shipping: ShippingInfo;
      idempotencyKey: string;
};

type CartLineForOrder = {
      variantId: bigint;
      quantity: number;
      sku: string;
      productName: string;
      productSlug: string;
      colorName: string;
      sizeName: string;
      unitPrice: bigint;
};

@Injectable()
export class OrdersService {
      constructor(private readonly prisma: PrismaService) {}

      /**
       * Biến giỏ hàng thành đơn hàng.
       *
       * Cả bốn việc — chiếm khoá chống trùng, trừ tồn, tạo đơn, xoá giỏ — nằm trong
       * một transaction. Trừ tồn xong mà tạo đơn lỗi nghĩa là hàng biến mất khỏi kho
       * mà không ai mua.
       */
      async placeOrder(input: PlaceOrderInput): Promise<OrderDetail> {
            try {
                  const orderId = await this.prisma.$transaction(
                        async (tx) => {
                              /**
                               * Chiếm khoá trước mọi việc khác.
                               *
                               * Ràng buộc `UNIQUE` trên `key` là thứ chặn thật. Yêu cầu thứ hai
                               * cùng khoá sẽ dừng ngay tại đây, trước khi chạm vào tồn kho —
                               * đặt câu lệnh này xuống cuối thì nó đã kịp trừ tồn rồi mới phát
                               * hiện trùng, và câu trả lời cho khách thành "hết hàng" thay vì
                               * "đây là đơn bạn vừa đặt".
                               */
                              await tx.idempotencyKey.create({
                                    data: {
                                          key: input.idempotencyKey,
                                          userId: input.userId,
                                          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
                                    },
                              });

                              /**
                               * Tra giỏ sau khi đã chiếm khoá, không phải trước.
                               *
                               * Tra trước thì lần gửi lại sau khi đơn đã tạo sẽ gặp giỏ rỗng —
                               * chính transaction đầu đã xoá nó — và trả về "không tìm thấy giỏ"
                               * thay vì trả lại đơn vừa đặt. Như vậy là phá ràng buộc R3.
                               */
                              const cart = await tx.cart.findUnique({ where: { userId: input.userId }, select: { id: true } });

                              if (cart === null) {
                                    throw new DomainException(HttpStatus.CONFLICT, 'Giỏ hàng đang trống', { reason: 'CART_EMPTY' });
                              }

                              const lines = await this.readCartForOrder(tx, cart.id);

                              await this.decrementStock(tx, lines);

                              const order = await this.createOrder(tx, input, lines);

                              // Giỏ biến mất cùng lúc đơn hình thành. Để lại giỏ nghĩa là khách
                              // quay về trang giỏ và thấy thứ mình vừa mua vẫn nằm đó.
                              await tx.cart.delete({ where: { id: cart.id } });

                              await tx.idempotencyKey.update({ where: { key: input.idempotencyKey }, data: { orderId: order.id } });

                              return order.id;
                        },
                        { timeout: TRANSACTION_TIMEOUT_MS },
                  );

                  return this.findById(orderId);
            } catch (error) {
                  return this.resolveDuplicate(error, input.idempotencyKey);
            }
      }

      async listForUser(userId: bigint): Promise<OrderSummary[]> {
            const orders = await this.prisma.order.findMany({
                  where: { userId },
                  orderBy: { placedAt: 'desc' },
                  select: {
                        orderNumber: true,
                        status: true,
                        paymentMethod: true,
                        paymentStatus: true,
                        placedAt: true,
                        total: true,
                        items: { select: { quantity: true } },
                  },
            });

            return orders.map((order) => ({
                  orderNumber: order.orderNumber,
                  status: order.status,
                  paymentMethod: order.paymentMethod,
                  paymentStatus: order.paymentStatus,
                  placedAt: order.placedAt.toISOString(),
                  itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
                  total: vndToJson(order.total),
            }));
      }

      /**
       * Đọc một đơn theo mã công khai.
       *
       * Không phải chủ đơn thì nhận "không tìm thấy", không phải "không có quyền":
       * câu trả lời thứ hai xác nhận mã đơn đó có thật, và mã đơn có thể dò được.
       */
      async findByNumber(orderNumber: string, userId?: bigint): Promise<OrderDetail> {
            const order = await this.prisma.order.findUnique({ where: { orderNumber }, select: { id: true, userId: true } });

            if (order === null || order.userId !== (userId ?? null)) {
                  throw new NotFoundException('Không tìm thấy đơn hàng');
            }

            return this.findById(order.id);
      }

      private async findById(id: bigint): Promise<OrderDetail> {
            const order = await this.prisma.order.findUniqueOrThrow({
                  where: { id },
                  include: { items: { orderBy: { id: 'asc' } } },
            });

            const lines: OrderLine[] = order.items.map((item) => ({
                  sku: item.sku,
                  productName: item.productName,
                  productSlug: item.productSlug,
                  colorName: item.colorName,
                  sizeName: item.sizeName,
                  quantity: item.quantity,
                  unitPrice: vndToJson(item.unitPrice),
                  lineTotal: vndToJson(item.lineTotal),
            }));

            return {
                  orderNumber: order.orderNumber,
                  status: order.status,
                  paymentMethod: order.paymentMethod,
                  paymentStatus: order.paymentStatus,
                  placedAt: order.placedAt.toISOString(),
                  itemCount: lines.reduce((total, line) => total + line.quantity, 0),
                  subtotal: vndToJson(order.subtotal),
                  shippingFee: vndToJson(order.shippingFee),
                  total: vndToJson(order.total),
                  lines,
                  shipping: {
                        recipientName: order.recipientName,
                        recipientPhone: order.recipientPhone,
                        addressLine: order.addressLine,
                        ward: order.ward,
                        district: order.district,
                        province: order.province,
                        note: order.note ?? undefined,
                  },
            };
      }

      /**
       * Đọc giỏ và chốt giá ngay trong transaction.
       *
       * Đọc ngoài transaction thì giỏ có thể đổi giữa lúc đọc và lúc ghi, và đơn tạo
       * ra không khớp với thứ đã kiểm.
       *
       * Sắp theo `variantId` tăng dần: đây là thứ tự khoá cố định cho bước trừ tồn.
       */
      private async readCartForOrder(tx: Prisma.TransactionClient, cartId: bigint): Promise<CartLineForOrder[]> {
            const items = await tx.cartItem.findMany({
                  where: { cartId },
                  orderBy: { variantId: 'asc' },
                  select: {
                        variantId: true,
                        quantity: true,
                        variant: {
                              select: {
                                    sku: true,
                                    price: true,
                                    isActive: true,
                                    product: { select: { name: true, slug: true, status: true, archivedAt: true } },
                                    color: { select: { name: true } },
                                    size: { select: { name: true } },
                              },
                        },
                  },
            });

            if (items.length === 0) {
                  throw new DomainException(HttpStatus.CONFLICT, 'Giỏ hàng đang trống', { reason: 'CART_EMPTY' });
            }

            return items.map((item) => {
                  const { variant } = item;

                  if (!variant.isActive || variant.product.archivedAt !== null || variant.product.status !== 'PUBLISHED') {
                        throw new DomainException(HttpStatus.CONFLICT, 'Sản phẩm "' + variant.product.name + '" hiện không bán', {
                              reason: 'NOT_SELLABLE',
                              sku: variant.sku,
                        });
                  }

                  return {
                        variantId: item.variantId,
                        quantity: item.quantity,
                        sku: variant.sku,
                        productName: variant.product.name,
                        productSlug: variant.product.slug,
                        colorName: variant.color.name,
                        sizeName: variant.size.name,
                        // Giá chốt tại đây và không bao giờ đọc lại từ catalog (ràng buộc R4).
                        unitPrice: variant.price,
                  };
            });
      }

      /**
       * Trừ tồn kho bằng một câu lệnh cho mỗi dòng.
       *
       * `WHERE stock_quantity >= quantity` khiến việc kiểm và việc trừ là cùng một
       * thao tác. Kiểm trước rồi trừ sau để lại một khe hở: giữa hai câu lệnh, một
       * đơn khác đã kịp lấy hết hàng, và cả hai đơn cùng đặt được chiếc áo cuối cùng.
       *
       * Số dòng bị ảnh hưởng là câu trả lời: 0 nghĩa là không đủ hàng.
       *
       * Chạy tuần tự theo thứ tự `variantId` tăng dần chứ không song song. Hai đơn
       * có chung hai sản phẩm mà trừ theo thứ tự ngược nhau sẽ khoá chéo và cả hai
       * cùng chết.
       */
      private async decrementStock(tx: Prisma.TransactionClient, lines: CartLineForOrder[]): Promise<void> {
            for (const line of lines) {
                  const result = await tx.productVariant.updateMany({
                        where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
                        data: { stockQuantity: { decrement: line.quantity } },
                  });

                  if (result.count === 0) {
                        const variant = await tx.productVariant.findUnique({
                              where: { id: line.variantId },
                              select: { stockQuantity: true },
                        });

                        throw new DomainException(
                              HttpStatus.CONFLICT,
                              'Sản phẩm "' + line.productName + '" size ' + line.sizeName + ' không còn đủ hàng',
                              { reason: 'OUT_OF_STOCK', sku: line.sku, availableQuantity: variant?.stockQuantity ?? 0 },
                        );
                  }
            }
      }

      private async createOrder(tx: Prisma.TransactionClient, input: PlaceOrderInput, lines: CartLineForOrder[]): Promise<{ id: bigint }> {
            const subtotal = lines.reduce((total, line) => total + line.unitPrice * BigInt(line.quantity), 0n);

            // Phí vận chuyển bằng 0 ở S08. Cách tính theo vùng chưa xếp bước, nhưng cột
            // đã có nên thêm sau không phải đụng tới đơn cũ.
            const shippingFee = 0n;

            return tx.order.create({
                  data: {
                        userId: input.userId,
                        orderNumber: await this.nextOrderNumber(tx),
                        paymentMethod: 'COD',
                        recipientName: input.shipping.recipientName,
                        recipientPhone: input.shipping.recipientPhone,
                        addressLine: input.shipping.addressLine,
                        ward: input.shipping.ward,
                        district: input.shipping.district,
                        province: input.shipping.province,
                        note: input.shipping.note,
                        subtotal,
                        shippingFee,
                        total: subtotal + shippingFee,
                        items: {
                              create: lines.map((line) => ({
                                    variantId: line.variantId,
                                    sku: line.sku,
                                    productName: line.productName,
                                    productSlug: line.productSlug,
                                    colorName: line.colorName,
                                    sizeName: line.sizeName,
                                    quantity: line.quantity,
                                    unitPrice: line.unitPrice,
                                    lineTotal: line.unitPrice * BigInt(line.quantity),
                              })),
                        },
                  },
                  select: { id: true },
            });
      }

      /**
       * Cấp số thứ tự tiếp theo trong ngày và ghép thành mã đơn theo ADR-002.
       *
       * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` là một câu lệnh nguyên tử.
       * `SELECT MAX() + 1` thì không: hai đơn đặt đồng thời cùng đọc một giá trị và
       * sinh ra hai mã trùng nhau.
       */
      private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
            const day = vietnamDayOf(new Date());

            const rows = await tx.$queryRaw<Array<{ last_value: number }>>`
                  INSERT INTO order_number_counters ("day", last_value)
                  VALUES (${day}::date, 1)
                  ON CONFLICT ("day") DO UPDATE SET last_value = order_number_counters.last_value + 1
                  RETURNING last_value
            `;

            const sequence = rows[0]?.last_value;

            if (sequence === undefined) {
                  throw new Error('Bộ đếm số đơn không trả về giá trị');
            }

            return formatOrderNumber(day, sequence);
      }

      /**
       * Xử lý trường hợp khoá chống trùng đã tồn tại: trả lại đúng đơn của lần gọi đầu.
       *
       * Đây là phần đáp ứng ràng buộc R3. Client gửi lại vì mạng chập chờn hoặc vì
       * khách bấm hai lần, và câu trả lời đúng là đơn đã tạo, không phải đơn thứ hai
       * và cũng không phải một thông báo lỗi.
       */
      private async resolveDuplicate(error: unknown, key: string): Promise<OrderDetail> {
            const isDuplicateKey = error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;

            if (!isDuplicateKey) {
                  throw error;
            }

            const existing = await this.prisma.idempotencyKey.findUnique({ where: { key }, select: { orderId: true } });

            if (existing?.orderId == null) {
                  // Khoá đã bị chiếm nhưng đơn chưa hình thành: yêu cầu trước còn đang
                  // chạy. Trả lời "thử lại" thay vì tạo đơn thứ hai.
                  throw new DomainException(HttpStatus.CONFLICT, 'Đơn hàng đang được xử lý, vui lòng thử lại sau giây lát', {
                        reason: 'IN_PROGRESS',
                  });
            }

            return this.findById(existing.orderId);
      }
}

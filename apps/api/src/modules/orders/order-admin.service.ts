import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
      vndToJson,
      type AdminOrderSummary,
      type OrderDetailWithHistory,
      type OrderHistoryEntry,
      type OrderStatus,
      type PaymentStatus,
} from '@shopflow/shared';

import { DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { allowedTransitions, canTransition, shouldRestoreStock } from './domain/order-status.js';
import { OrdersService } from './orders.service.js';

/** Số đơn mỗi trang trong màn hình quản trị. */
export const ADMIN_ORDERS_PAGE_SIZE = 20;

export type ChangeStatusInput = {
      orderNumber: string;
      to: OrderStatus;
      actorId: bigint;
      isAdmin: boolean;
      note?: string;
};

export type AdminOrderQuery = {
      status?: OrderStatus;
      from?: Date;
      to?: Date;
      search?: string;
      page: number;
};

@Injectable()
export class OrderAdminService {
      constructor(
            private readonly prisma: PrismaService,
            private readonly orders: OrdersService,
      ) {}

      /**
       * Chi tiết đơn kèm lịch sử và những bước chuyển hợp lệ từ trạng thái hiện tại.
       *
       * Danh sách bước chuyển do máy chủ tính, không phải giao diện tự suy: giao diện
       * tự suy thì hai nơi cùng giữ một luật và sớm muộn lệch nhau.
       */
      async detail(orderNumber: string, viewer: { id: bigint; isAdmin: boolean }): Promise<OrderDetailWithHistory> {
            const detail = viewer.isAdmin
                  ? await this.orders.detailByNumber(orderNumber)
                  : await this.orders.findByNumber(orderNumber, viewer.id);

            return {
                  ...detail,
                  history: await this.historyOf(orderNumber),
                  allowedTransitions: [...allowedTransitions(detail.status, viewer.isAdmin)],
            };
      }

      /**
       * Chuyển trạng thái đơn, và cộng trả tồn kho nếu đây là lần huỷ.
       *
       * Toàn bộ nằm trong một transaction, và bước đổi trạng thái nêu rõ trạng thái
       * xuất phát: `UPDATE ... WHERE status = <cũ>`. Số dòng bị ảnh hưởng bằng 0
       * nghĩa là ai đó đã đổi trước — hoặc chính người này bấm huỷ lần thứ hai. Đó
       * là thứ chặn việc cộng trả tồn kho hai lần, không phải một biến cờ trong mã.
       */
      async changeStatus(input: ChangeStatusInput): Promise<void> {
            await this.prisma.$transaction(async (tx) => {
                  const order = await tx.order.findUnique({
                        where: { orderNumber: input.orderNumber },
                        select: { id: true, userId: true, status: true },
                  });

                  // Không phải chủ đơn và cũng không phải quản trị viên thì đơn này coi
                  // như không tồn tại, đúng cách đã làm ở endpoint xem đơn.
                  if (order === null || (!input.isAdmin && order.userId !== input.actorId)) {
                        throw new NotFoundException('Không tìm thấy đơn hàng');
                  }

                  if (!canTransition(order.status, input.to, input.isAdmin)) {
                        throw new DomainException(HttpStatus.CONFLICT, this.describeRejection(order.status, input.to, input.isAdmin), {
                              reason: 'INVALID_TRANSITION',
                              from: order.status,
                              to: input.to,
                        });
                  }

                  const updated = await tx.order.updateMany({
                        where: { id: order.id, status: order.status },
                        data: { status: input.to },
                  });

                  if (updated.count === 0) {
                        throw new DomainException(HttpStatus.CONFLICT, 'Đơn vừa được cập nhật bởi thao tác khác. Tải lại rồi thử lại.', {
                              reason: 'CONCURRENT_CHANGE',
                        });
                  }

                  if (input.to === 'CANCELLED' && shouldRestoreStock(order.status)) {
                        await this.restoreStock(tx, order.id);
                  }

                  await tx.orderStatusHistory.create({
                        data: {
                              orderId: order.id,
                              fromStatus: order.status,
                              toStatus: input.to,
                              changedById: input.actorId,
                              note: input.note,
                        },
                  });
            });
      }

      /**
       * Đánh dấu đơn đã thu tiền.
       *
       * Cùng cơ chế nêu trạng thái xuất phát trong `WHERE`: bấm hai lần thì lần thứ
       * hai không có dòng nào bị ảnh hưởng và không sinh thêm dòng lịch sử.
       */
      async changePaymentStatus(orderNumber: string, to: PaymentStatus, actorId: bigint, note?: string): Promise<void> {
            await this.prisma.$transaction(async (tx) => {
                  const order = await tx.order.findUnique({
                        where: { orderNumber },
                        select: { id: true, paymentStatus: true },
                  });

                  if (order === null) {
                        throw new NotFoundException('Không tìm thấy đơn hàng');
                  }

                  if (order.paymentStatus === to) {
                        throw new DomainException(HttpStatus.CONFLICT, 'Đơn đã ở trạng thái thanh toán này', {
                              reason: 'INVALID_TRANSITION',
                              from: order.paymentStatus,
                              to,
                        });
                  }

                  const updated = await tx.order.updateMany({
                        where: { id: order.id, paymentStatus: order.paymentStatus },
                        data: { paymentStatus: to },
                  });

                  if (updated.count === 0) {
                        throw new DomainException(HttpStatus.CONFLICT, 'Đơn vừa được cập nhật bởi thao tác khác. Tải lại rồi thử lại.', {
                              reason: 'CONCURRENT_CHANGE',
                        });
                  }

                  await tx.orderStatusHistory.create({
                        data: {
                              orderId: order.id,
                              paymentFromStatus: order.paymentStatus,
                              paymentToStatus: to,
                              changedById: actorId,
                              note,
                        },
                  });
            });
      }

      /**
       * Danh sách đơn cho quản trị viên, có lọc và phân trang.
       *
       * Hai truy vấn cố định — một đếm, một lấy trang — bất kể số đơn. Số sản phẩm
       * của mỗi đơn lấy kèm trong cùng truy vấn, chỉ lấy cột số lượng chứ không tải
       * toàn bộ dòng đơn về.
       */
      async list(query: AdminOrderQuery): Promise<{ items: AdminOrderSummary[]; total: number }> {
            const where = this.buildWhere(query);

            const [total, orders] = await Promise.all([
                  this.prisma.order.count({ where }),
                  this.prisma.order.findMany({
                        where,
                        orderBy: { placedAt: 'desc' },
                        skip: (query.page - 1) * ADMIN_ORDERS_PAGE_SIZE,
                        take: ADMIN_ORDERS_PAGE_SIZE,
                        select: {
                              orderNumber: true,
                              status: true,
                              paymentMethod: true,
                              paymentStatus: true,
                              placedAt: true,
                              total: true,
                              recipientName: true,
                              recipientPhone: true,
                              province: true,
                              items: { select: { quantity: true } },
                        },
                  }),
            ]);

            return {
                  total,
                  items: orders.map((order) => ({
                        orderNumber: order.orderNumber,
                        status: order.status,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        placedAt: order.placedAt.toISOString(),
                        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
                        total: vndToJson(order.total),
                        recipientName: order.recipientName,
                        recipientPhone: order.recipientPhone,
                        province: order.province,
                  })),
            };
      }

      async historyOf(orderNumber: string): Promise<OrderHistoryEntry[]> {
            const rows = await this.prisma.orderStatusHistory.findMany({
                  where: { order: { orderNumber } },
                  orderBy: { createdAt: 'asc' },
                  select: {
                        createdAt: true,
                        fromStatus: true,
                        toStatus: true,
                        paymentFromStatus: true,
                        paymentToStatus: true,
                        note: true,
                        changedBy: { select: { fullName: true } },
                  },
            });

            return rows.map((row): OrderHistoryEntry => {
                  const common = {
                        at: row.createdAt.toISOString(),
                        changedBy: row.changedBy?.fullName ?? null,
                        note: row.note,
                  };

                  // Ràng buộc CHECK bảo đảm đúng một trong hai cột "to" có giá trị.
                  return row.toStatus === null
                        ? { ...common, kind: 'PAYMENT', from: row.paymentFromStatus, to: row.paymentToStatus as PaymentStatus }
                        : { ...common, kind: 'STATUS', from: row.fromStatus, to: row.toStatus };
            });
      }

      /**
       * Cộng trả tồn kho của một đơn bị huỷ.
       *
       * Theo thứ tự `variantId` tăng dần, cùng thứ tự với lúc trừ tồn: hai thao tác
       * chạm vào cùng những hàng đó mà theo thứ tự ngược nhau sẽ khoá chéo.
       *
       * Dòng đơn có `variantId` rỗng thì bỏ qua — biến thể đã bị xoá khỏi catalog và
       * không còn chỗ nào để cộng trả.
       */
      private async restoreStock(tx: Prisma.TransactionClient, orderId: bigint): Promise<void> {
            const items = await tx.orderItem.findMany({
                  where: { orderId, variantId: { not: null } },
                  orderBy: { variantId: 'asc' },
                  select: { variantId: true, quantity: true },
            });

            for (const item of items) {
                  await tx.productVariant.update({
                        where: { id: item.variantId as bigint },
                        data: { stockQuantity: { increment: item.quantity } },
                  });
            }
      }

      private buildWhere(query: AdminOrderQuery): Prisma.OrderWhereInput {
            const where: Prisma.OrderWhereInput = {};

            if (query.status !== undefined) {
                  where.status = query.status;
            }

            if (query.from !== undefined || query.to !== undefined) {
                  where.placedAt = { gte: query.from, lte: query.to };
            }

            if (query.search !== undefined && query.search !== '') {
                  // Khách gọi tới đọc mã đơn hoặc số điện thoại; một ô tìm kiếm phục vụ
                  // cả hai, vì người trực máy không nên phải chọn đang tra theo cái gì.
                  where.OR = [
                        { orderNumber: { contains: query.search, mode: 'insensitive' } },
                        { recipientPhone: { contains: query.search } },
                  ];
            }

            return where;
      }

      /** Nhãn tiếng Việt của trạng thái, dùng trong thông báo lỗi gửi cho người dùng. */
      private static readonly STATUS_LABELS: Record<OrderStatus, string> = {
            PENDING: 'chờ xác nhận',
            CONFIRMED: 'đã xác nhận',
            SHIPPING: 'đang giao',
            DELIVERED: 'đã giao',
            CANCELLED: 'đã huỷ',
      };

      private describeRejection(from: OrderStatus, to: OrderStatus, isAdmin: boolean): string {
            const label = OrderAdminService.STATUS_LABELS[from];

            if (to === 'CANCELLED') {
                  return isAdmin
                        ? 'Đơn đang ở trạng thái ' + label + ' nên không huỷ được nữa'
                        : 'Đơn đang ở trạng thái ' + label + ' nên không tự huỷ được. Liên hệ shop để được hỗ trợ.';
            }

            return 'Không chuyển được đơn từ trạng thái ' + label + ' sang trạng thái này';
      }
}

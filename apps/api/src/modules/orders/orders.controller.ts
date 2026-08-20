import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { OrderDetail, OrderDetailWithHistory, OrderSummary } from '@shopflow/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { cancelOrderSchema, type CancelOrderBody } from './dto/admin-order.schema.js';
import { idempotencyKeySchema, placeOrderSchema, type PlaceOrderBody } from './dto/place-order.schema.js';
import { OrderAdminService } from './order-admin.service.js';
import { OrdersService } from './orders.service.js';

/**
 * Đặt hàng và xem đơn. Cả ba đường dẫn đều yêu cầu đăng nhập.
 *
 * Giỏ hàng phục vụ khách ẩn danh đầy đủ, nhưng đơn hàng phải thuộc về một tài
 * khoản: đơn không có chủ thì không có cách nào cho khách xem lại, và mã đơn tự
 * nó không đủ làm bằng chứng sở hữu.
 */
@Controller('orders')
export class OrdersController {
      constructor(
            private readonly orders: OrdersService,
            private readonly admin: OrderAdminService,
      ) {}

      /**
       * Tạo đơn từ giỏ của tài khoản đang đăng nhập.
       *
       * `Idempotency-Key` là bắt buộc. Không có nó thì một lần bấm gửi hai request —
       * chuyện bình thường khi mạng chập chờn — sẽ tạo hai đơn (ràng buộc R3).
       */
      @Post()
      @HttpCode(HttpStatus.CREATED)
      async place(
            @Body(new ZodValidationPipe(placeOrderSchema)) input: PlaceOrderBody,
            @Headers('idempotency-key') rawKey: string | undefined,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<OrderDetail> {
            const parsedKey = idempotencyKeySchema.safeParse(rawKey ?? '');

            if (!parsedKey.success) {
                  throw new BadRequestException('Thiếu hoặc sai header Idempotency-Key');
            }

            // Giỏ được tra bên trong transaction của service, sau khi khoá chống trùng
            // đã bị chiếm. Tra ở đây thì lần gửi lại sẽ gặp giỏ rỗng và trả sai.
            return this.orders.placeOrder({ userId: user.id, shipping: input, idempotencyKey: parsedKey.data });
      }

      @Get()
      list(@CurrentUser() user: AuthenticatedUser): Promise<OrderSummary[]> {
            return this.orders.listForUser(user.id);
      }

      @Get(':orderNumber')
      detail(@Param('orderNumber') orderNumber: string, @CurrentUser() user: AuthenticatedUser): Promise<OrderDetailWithHistory> {
            return this.admin.detail(orderNumber, { id: user.id, isAdmin: false });
      }

      /**
       * Khách tự huỷ đơn của mình.
       *
       * Chỉ huỷ được khi đơn còn chờ xác nhận. Đã xác nhận nghĩa là người bán đã bắt
       * đầu soạn hàng, và lúc đó việc huỷ cần một cuộc trao đổi. Luật này nằm trong
       * máy trạng thái, không phải ở đây.
       */
      @Post(':orderNumber/cancel')
      @HttpCode(HttpStatus.OK)
      async cancel(
            @Param('orderNumber') orderNumber: string,
            @Body(new ZodValidationPipe(cancelOrderSchema)) input: CancelOrderBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<OrderDetailWithHistory> {
            await this.admin.changeStatus({
                  orderNumber,
                  to: 'CANCELLED',
                  actorId: user.id,
                  isAdmin: false,
                  note: input.note,
            });

            return this.admin.detail(orderNumber, { id: user.id, isAdmin: false });
      }
}

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { OrderDetail, OrderSummary } from '@shopflow/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { idempotencyKeySchema, placeOrderSchema, type PlaceOrderBody } from './dto/place-order.schema.js';
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
      constructor(private readonly orders: OrdersService) {}

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
      detail(@Param('orderNumber') orderNumber: string, @CurrentUser() user: AuthenticatedUser): Promise<OrderDetail> {
            return this.orders.findByNumber(orderNumber, user.id);
      }
}

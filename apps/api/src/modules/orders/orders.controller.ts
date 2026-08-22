import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
      orderConflictDetailSchema,
      orderDetailSchema,
      orderDetailWithHistorySchema,
      orderSummarySchema,
      type OrderDetail,
      type OrderDetailWithHistory,
      type OrderSummary,
} from '@shopflow/shared';

import { ApiEnvelope, ApiErrors, ApiErrorWithDetails } from '../../common/openapi/envelope-response.decorator.js';
import { BEARER_AUTH } from '../../common/openapi/swagger.js';
import { ApiZodBody } from '../../common/openapi/zod-request.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { cancelOrderSchema, type CancelOrderBody } from './dto/admin-order.schema.js';
import { idempotencyKeySchema, placeOrderSchema, type PlaceOrderBody } from './dto/place-order.schema.js';
import { OrderAdminService } from './order-admin.service.js';
import { OrdersService } from './orders.service.js';

const ORDER_NUMBER_PARAM = { name: 'orderNumber', example: 'SF-20260822-0001' };

/**
 * Đặt hàng và xem đơn. Cả ba đường dẫn đều yêu cầu đăng nhập.
 *
 * Giỏ hàng phục vụ khách ẩn danh đầy đủ, nhưng đơn hàng phải thuộc về một tài
 * khoản: đơn không có chủ thì không có cách nào cho khách xem lại, và mã đơn tự
 * nó không đủ làm bằng chứng sở hữu.
 */
@ApiTags('Đơn hàng')
@ApiBearerAuth(BEARER_AUTH)
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
      @ApiOperation({
            summary: 'Đặt hàng từ giỏ',
            description:
                  'Gửi lại cùng một `Idempotency-Key` trả về chính đơn đã tạo chứ không tạo đơn thứ hai. Giá chốt tại thời điểm đặt và không đổi theo bảng giá về sau.',
      })
      @ApiHeader({
            name: 'Idempotency-Key',
            required: true,
            description: 'Khoá chống trùng, 16–128 ký tự. Dùng UUID v4 sinh một lần cho mỗi lần bấm đặt hàng.',
            schema: { type: 'string', example: '3f2a9c1e-77b4-4e1a-9c53-6b0d2f8e41aa' },
      })
      @ApiZodBody(placeOrderSchema)
      @ApiEnvelope(orderDetailSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
      @ApiErrorWithDetails(
            HttpStatus.CONFLICT,
            orderConflictDetailSchema,
            '`CONFLICT` — giỏ rỗng, hết tồn, biến thể ngừng bán, hoặc một yêu cầu cùng khoá đang xử lý',
      )
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
      @ApiOperation({ summary: 'Đơn hàng của tôi', description: 'Sắp xếp theo thời điểm đặt, mới nhất trước.' })
      @ApiEnvelope(orderSummarySchema, { isArray: true })
      @ApiErrors(HttpStatus.UNAUTHORIZED)
      list(@CurrentUser() user: AuthenticatedUser): Promise<OrderSummary[]> {
            return this.orders.listForUser(user.id);
      }

      @Get(':orderNumber')
      @ApiOperation({ summary: 'Chi tiết một đơn của tôi' })
      @ApiParam(ORDER_NUMBER_PARAM)
      @ApiEnvelope(orderDetailWithHistorySchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
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
      @ApiOperation({
            summary: 'Huỷ đơn của tôi',
            description: 'Chỉ huỷ được khi đơn còn ở trạng thái `PENDING`. Đã xác nhận thì phải liên hệ người bán.',
      })
      @ApiParam(ORDER_NUMBER_PARAM)
      @ApiZodBody(cancelOrderSchema)
      @ApiEnvelope(orderDetailWithHistorySchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
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

import { Body, Controller, Get, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
      adminOrderSummarySchema,
      orderDetailWithHistorySchema,
      type AdminOrderSummary,
      type Meta,
      type OrderDetailWithHistory,
} from '@shopflow/shared';

import { ApiEnvelope, ApiErrors } from '../../common/openapi/envelope-response.decorator.js';
import { BEARER_AUTH } from '../../common/openapi/swagger.js';
import { ApiZodBody, ApiZodQuery } from '../../common/openapi/zod-request.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { adminOrderQuerySchema, updateOrderSchema, type AdminOrderQueryInput, type UpdateOrderBody } from './dto/admin-order.schema.js';
import { ADMIN_ORDERS_PAGE_SIZE, OrderAdminService } from './order-admin.service.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const ORDER_NUMBER_PARAM = { name: 'orderNumber', example: 'SF-20260822-0001' };

/**
 * Khu vực quản trị đơn hàng.
 *
 * `@Roles(ADMIN)` đặt ở cấp lớp: quên đánh dấu một phương thức mới thì nó vẫn được
 * bảo vệ. Đây là chỗ dùng đầu tiên của `RolesGuard`, vốn có từ S06.
 */
@ApiTags('Quản trị đơn hàng')
@ApiBearerAuth(BEARER_AUTH)
@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
      constructor(private readonly admin: OrderAdminService) {}

      @Get()
      @ApiOperation({
            summary: 'Danh sách đơn hàng',
            description: 'Lọc theo trạng thái, khoảng ngày đặt và từ khoá. Khoảng ngày hiểu theo giờ Việt Nam.',
      })
      @ApiZodQuery(adminOrderQuerySchema)
      @ApiEnvelope(adminOrderSummarySchema, { paginated: true })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
      async list(
            @Query(new ZodValidationPipe(adminOrderQuerySchema)) query: AdminOrderQueryInput,
      ): Promise<{ items: AdminOrderSummary[]; meta: Meta }> {
            const { items, total } = await this.admin.list({
                  status: query.status,
                  from: this.startOfVietnamDay(query.from),
                  to: this.endOfVietnamDay(query.to),
                  search: query.search,
                  page: query.page,
            });

            return { items, meta: { page: query.page, limit: ADMIN_ORDERS_PAGE_SIZE, total } };
      }

      @Get(':orderNumber')
      @ApiOperation({ summary: 'Chi tiết một đơn bất kỳ' })
      @ApiParam(ORDER_NUMBER_PARAM)
      @ApiEnvelope(orderDetailWithHistorySchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      detail(@Param('orderNumber') orderNumber: string, @CurrentUser() user: AuthenticatedUser): Promise<OrderDetailWithHistory> {
            return this.admin.detail(orderNumber, { id: user.id, isAdmin: true });
      }

      /**
       * Chuyển trạng thái đơn hoặc trạng thái thanh toán.
       *
       * Trả về đơn sau thay đổi kèm lịch sử, để giao diện không phải gọi thêm một
       * lượt và không có khoảng thời gian hiển thị dữ liệu cũ.
       */
      @Patch(':orderNumber')
      @ApiOperation({
            summary: 'Đổi trạng thái đơn hoặc trạng thái thanh toán',
            description:
                  'Nêu đúng một trong hai trường `status` và `paymentStatus`. Bước chuyển không hợp lệ trả 409. Trả về đơn sau thay đổi kèm lịch sử.',
      })
      @ApiParam(ORDER_NUMBER_PARAM)
      @ApiZodBody(updateOrderSchema)
      @ApiEnvelope(orderDetailWithHistorySchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
      async update(
            @Param('orderNumber') orderNumber: string,
            @Body(new ZodValidationPipe(updateOrderSchema)) input: UpdateOrderBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<OrderDetailWithHistory> {
            if (input.status !== undefined) {
                  await this.admin.changeStatus({
                        orderNumber,
                        to: input.status,
                        actorId: user.id,
                        isAdmin: true,
                        note: input.note,
                  });
            } else if (input.paymentStatus !== undefined) {
                  await this.admin.changePaymentStatus(orderNumber, input.paymentStatus, user.id, input.note);
            }

            return this.admin.detail(orderNumber, { id: user.id, isAdmin: true });
      }

      /**
       * Đầu ngày theo giờ Việt Nam, quy về thời điểm UTC tương ứng.
       *
       * Lọc thẳng bằng chuỗi ngày là lọc theo UTC, và đơn đặt buổi tối ở Việt Nam
       * rơi sang ngày hôm sau.
       */
      private startOfVietnamDay(day: string | undefined): Date | undefined {
            return day === undefined ? undefined : this.vietnamMidnightUtc(day);
      }

      private endOfVietnamDay(day: string | undefined): Date | undefined {
            return day === undefined ? undefined : new Date(this.vietnamMidnightUtc(day).getTime() + MILLISECONDS_PER_DAY - 1);
      }

      private vietnamMidnightUtc(day: string): Date {
            // Giờ Việt Nam là UTC+7 quanh năm, không đổi giờ theo mùa.
            return new Date(day + 'T00:00:00+07:00');
      }
}

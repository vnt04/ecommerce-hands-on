import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import type { AdminOrderSummary, Meta, OrderDetailWithHistory } from '@shopflow/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { adminOrderQuerySchema, updateOrderSchema, type AdminOrderQueryInput, type UpdateOrderBody } from './dto/admin-order.schema.js';
import { ADMIN_ORDERS_PAGE_SIZE, OrderAdminService } from './order-admin.service.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Khu vực quản trị đơn hàng.
 *
 * `@Roles(ADMIN)` đặt ở cấp lớp: quên đánh dấu một phương thức mới thì nó vẫn được
 * bảo vệ. Đây là chỗ dùng đầu tiên của `RolesGuard`, vốn có từ S06.
 */
@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
      constructor(private readonly admin: OrderAdminService) {}

      @Get()
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

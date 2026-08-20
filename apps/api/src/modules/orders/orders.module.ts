import { Module } from '@nestjs/common';

import { AdminOrdersController } from './admin-orders.controller.js';
import { OrderAdminService } from './order-admin.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
      controllers: [OrdersController, AdminOrdersController],
      providers: [OrdersService, OrderAdminService],
      exports: [OrdersService, OrderAdminService],
})
export class OrdersModule {}

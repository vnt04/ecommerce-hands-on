import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { loadEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard, RolesGuard } from './modules/auth/auth.guards.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

/**
 * Đọc và kiểm tra cấu hình ngay lúc nạp module, trước khi Nest dựng bất cứ thứ gì.
 * Thiếu biến bắt buộc thì tiến trình chết tại đây với thông báo nêu đúng tên biến.
 */
const env = loadEnv();

const GLOBAL_RATE_LIMIT_TTL_MS = 60_000;
const GLOBAL_RATE_LIMIT = 100;

@Module({
      imports: [
            LoggerModule.forRoot({
                  pinoHttp: {
                        level: env.LOG_LEVEL,

                        /**
                         * Tôn trọng X-Request-Id do lớp biên gửi xuống nếu có, để một request
                         * đi qua nhiều dịch vụ vẫn giữ nguyên một mã. Không có thì tự sinh.
                         * Trả lại qua header để client và log đối chiếu được với nhau.
                         */
                        genReqId: (req, res) => {
                              const incoming = req.headers['x-request-id'];
                              const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

                              res.setHeader('X-Request-Id', requestId);

                              return requestId;
                        },

                        // Không bao giờ ghi thông tin xác thực vào log.
                        redact: {
                              paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
                              remove: true,
                        },
                  },
            }),

            /**
             * Trần chung cho mọi endpoint, dày hơn nhiều so với giới hạn riêng của các
             * endpoint xác thực. Lưu trong Redis để đếm đúng khi chạy nhiều bản sao.
             */
            ThrottlerModule.forRoot({
                  throttlers: [{ ttl: GLOBAL_RATE_LIMIT_TTL_MS, limit: GLOBAL_RATE_LIMIT }],
                  storage: new ThrottlerStorageRedisService(env.REDIS_URL),
            }),

            PrismaModule,
            RedisModule,
            StorageModule,
            AuthModule,
            CatalogModule,
            CartModule,
            OrdersModule,
      ],
      controllers: [HealthController],
      providers: [
            /**
             * Thứ tự có ý nghĩa: chặn theo tần suất trước, rồi mới xác thực và kiểm
             * quyền. Nhờ vậy tấn công dò mật khẩu bị chặn trước khi tốn một lượt bcrypt.
             *
             * JwtAuthGuard là guard toàn cục nên mặc định mọi endpoint đều bị chặn.
             * Endpoint công khai phải khai báo tường minh bằng @Public.
             */
            { provide: APP_GUARD, useClass: ThrottlerGuard },
            { provide: APP_GUARD, useClass: JwtAuthGuard },
            { provide: APP_GUARD, useClass: RolesGuard },
      ],
})
export class AppModule {}

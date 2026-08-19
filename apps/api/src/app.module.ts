import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { loadEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * Đọc và kiểm tra cấu hình ngay lúc nạp module, trước khi Nest dựng bất cứ thứ gì.
 * Thiếu biến bắt buộc thì tiến trình chết tại đây với thông báo nêu đúng tên biến.
 */
const env = loadEnv();

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
            PrismaModule,
            CatalogModule,
      ],
      controllers: [HealthController],
})
export class AppModule {}

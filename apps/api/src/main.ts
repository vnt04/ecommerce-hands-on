import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor.js';
import { bigIntReplacer } from './common/serialization/json-replacer.js';
import { loadEnv } from './config/env.js';

/**
 * Tiền tố phiên bản đặt ngay từ đầu (ADR trong S02). Khi cần đổi hợp đồng API
 * theo cách phá vỡ tương thích, thêm v2 song song thay vì buộc sửa đồng thời
 * cả frontend lẫn backend.
 */
const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
      const env = loadEnv();

      // bufferLogs giữ lại log phát sinh trước khi logger thật sẵn sàng,
      // nếu không thì lỗi lúc khởi động sẽ biến mất.
      const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

      app.useLogger(app.get(Logger));
      app.setGlobalPrefix(API_PREFIX);

      // Gắn ở tầng serialize của Express nên áp dụng cho mọi response.
      app.set('json replacer', bigIntReplacer);

      app.useGlobalInterceptors(new EnvelopeInterceptor());
      app.useGlobalFilters(new AllExceptionsFilter());

      // Cần thiết để onModuleDestroy chạy và Prisma đóng kết nối sạch khi container dừng.
      app.enableShutdownHooks();

      // 0.0.0.0 thay vì localhost để nhận được kết nối từ ngoài container.
      await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();

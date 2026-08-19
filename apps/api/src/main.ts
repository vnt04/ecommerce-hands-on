import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { formatVnd } from '@shopflow/shared';

import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;
const SAMPLE_AMOUNT = 299000n;

async function bootstrap(): Promise<void> {
      const app = await NestFactory.create(AppModule);
      const port = Number(process.env.PORT ?? DEFAULT_PORT);

      // Lắng nghe trên 0.0.0.0 thay vì localhost để nhận được kết nối từ ngoài container.
      await app.listen(port, '0.0.0.0');

      // Gọi formatVnd ở đây để xác nhận api phân giải được package shared lúc chạy thật,
      // không chỉ lúc biên dịch. Thay bằng log có cấu trúc ở S02.
      Logger.log(`api đang lắng nghe cổng ${port} — shared.formatVnd(${SAMPLE_AMOUNT}n) = ${formatVnd(SAMPLE_AMOUNT)}`, 'Bootstrap');
}

void bootstrap();

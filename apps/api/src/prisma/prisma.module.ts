import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Đánh dấu Global để module nghiệp vụ không phải import lại ở mọi nơi.
 * Đây là ngoại lệ có chủ đích, chỉ dành cho hạ tầng dùng chung.
 */
@Global()
@Module({
      providers: [PrismaService],
      exports: [PrismaService],
})
export class PrismaModule {}

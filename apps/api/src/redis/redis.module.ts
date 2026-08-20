import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service.js';

/** Hạ tầng dùng chung, đánh dấu Global như PrismaModule. */
@Global()
@Module({
      providers: [RedisService],
      exports: [RedisService],
})
export class RedisModule {}

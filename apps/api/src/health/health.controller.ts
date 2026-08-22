import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { ApiEnvelope, ApiErrors } from '../common/openapi/envelope-response.decorator.js';
import { Public } from '../modules/auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const livenessSchema = z.object({ status: z.literal('ok') });
const readinessSchema = z.object({ status: z.literal('ok'), database: z.literal('up'), redis: z.literal('up') });

type LivenessResult = z.infer<typeof livenessSchema>;
type ReadinessResult = z.infer<typeof readinessSchema>;

@ApiTags('Sức khoẻ')
@Public()
@Controller()
export class HealthController {
      constructor(
            private readonly prisma: PrismaService,
            private readonly redis: RedisService,
      ) {}

      /**
       * Kiểm tra sống: tiến trình còn phản hồi hay không. Cố ý không chạm phụ thuộc nào.
       *
       * Nếu endpoint này phụ thuộc database thì một sự cố database sẽ khiến bộ điều
       * phối giết và khởi động lại container liên tục, trong khi ứng dụng vẫn khoẻ.
       */
      @Get('healthz')
      @ApiOperation({ summary: 'Kiểm tra sống', description: 'Chỉ cho biết tiến trình còn phản hồi. Không chạm database hay Redis.' })
      @ApiEnvelope(livenessSchema)
      @ApiErrors()
      checkLiveness(): LivenessResult {
            return { status: 'ok' };
      }

      /** Kiểm tra sẵn sàng nhận lưu lượng: có phục vụ được không, gồm cả phụ thuộc. */
      @Get('readyz')
      @ApiOperation({ summary: 'Kiểm tra sẵn sàng', description: 'Trả 503 khi database hoặc Redis chưa kết nối được.' })
      @ApiEnvelope(readinessSchema)
      @ApiErrors(HttpStatus.SERVICE_UNAVAILABLE)
      async checkReadiness(): Promise<ReadinessResult> {
            const [databaseReachable, redisReachable] = await Promise.all([this.prisma.isReachable(), this.redis.isReachable()]);

            if (!databaseReachable || !redisReachable) {
                  throw new ServiceUnavailableException('Phụ thuộc chưa sẵn sàng');
            }

            return { status: 'ok', database: 'up', redis: 'up' };
      }
}

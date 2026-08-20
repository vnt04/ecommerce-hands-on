import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../modules/auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

type LivenessResult = { status: 'ok' };
type ReadinessResult = { status: 'ok'; database: 'up'; redis: 'up' };

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
      checkLiveness(): LivenessResult {
            return { status: 'ok' };
      }

      /** Kiểm tra sẵn sàng nhận lưu lượng: có phục vụ được không, gồm cả phụ thuộc. */
      @Get('readyz')
      async checkReadiness(): Promise<ReadinessResult> {
            const [databaseReachable, redisReachable] = await Promise.all([this.prisma.isReachable(), this.redis.isReachable()]);

            if (!databaseReachable || !redisReachable) {
                  throw new ServiceUnavailableException('Phụ thuộc chưa sẵn sàng');
            }

            return { status: 'ok', database: 'up', redis: 'up' };
      }
}

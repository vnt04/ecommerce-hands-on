import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

type LivenessResult = { status: 'ok' };
type ReadinessResult = { status: 'ok'; database: 'up' };

@Controller()
export class HealthController {
      constructor(private readonly prisma: PrismaService) {}

      /**
       * Kiểm tra sống: tiến trình còn phản hồi hay không. Cố ý không chạm database.
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
            const databaseReachable = await this.prisma.isReachable();

            if (!databaseReachable) {
                  throw new ServiceUnavailableException('Không kết nối được cơ sở dữ liệu');
            }

            return { status: 'ok', database: 'up' };
      }
}

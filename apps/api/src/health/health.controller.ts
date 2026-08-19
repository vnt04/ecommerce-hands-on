import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint kiểm tra sống. Giữ tối giản và không chạm cơ sở dữ liệu —
 * kiểm tra phụ thuộc là việc của /readyz, thêm ở S02.
 */
@Controller('healthz')
export class HealthController {
      @Get()
      check(): { status: 'ok' } {
            return { status: 'ok' };
      }
}

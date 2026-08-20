import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { loadEnv } from '../config/env.js';

/**
 * Kết nối Redis dùng chung.
 *
 * Hiện chỉ phục vụ rate limit. Được kéo lên sớm hơn kế hoạch gốc — xem phần
 * quyết định trong docs/steps/S06.md — nên nếu tới bước lên production vẫn chỉ
 * chạy một bản sao api thì đây là chỗ đáng xem lại.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
      readonly client: Redis;

      constructor() {
            const env = loadEnv();

            this.client = new Redis(env.REDIS_URL, {
                  // Không thử lại vô hạn: Redis chết thì /readyz phải báo ngay,
                  // thay vì để request treo cho tới khi hết thời gian chờ.
                  maxRetriesPerRequest: 1,
                  lazyConnect: false,
            });

            // ioredis tự thử kết nối lại. Không gắn trình xử lý thì lỗi kết nối trở
            // thành sự kiện error không ai bắt và làm sập tiến trình.
            this.client.on('error', () => undefined);
      }

      async onModuleDestroy(): Promise<void> {
            this.client.disconnect();
      }

      /** Lệnh rẻ nhất để xác nhận kết nối còn sống. Dùng cho /readyz. */
      async isReachable(): Promise<boolean> {
            try {
                  return (await this.client.ping()) === 'PONG';
            } catch {
                  return false;
            }
      }
}

import { describe, expect, test, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { HealthController } from './health.controller.js';

function createController(databaseReachable: boolean, redisReachable = true): HealthController {
      const prisma = { isReachable: vi.fn().mockResolvedValue(databaseReachable) } as unknown as PrismaService;
      const redis = { isReachable: vi.fn().mockResolvedValue(redisReachable) } as unknown as RedisService;

      return new HealthController(prisma, redis);
}

describe('HealthController', () => {
      test('healthz trả ok mà không chạm phụ thuộc nào', () => {
            expect(createController(false, false).checkLiveness()).toEqual({ status: 'ok' });
      });

      test('readyz trả ok khi mọi phụ thuộc kết nối được', async () => {
            await expect(createController(true).checkReadiness()).resolves.toEqual({
                  status: 'ok',
                  database: 'up',
                  redis: 'up',
            });
      });

      test('readyz ném lỗi khi database không kết nối được', async () => {
            // Chốt chặn quan trọng: bộ điều phối phải biết instance chưa sẵn sàng
            // nhận lưu lượng, thay vì nhận request rồi trả lỗi 500 cho khách.
            await expect(createController(false).checkReadiness()).rejects.toThrow();
      });

      test('readyz ném lỗi khi Redis không kết nối được', async () => {
            // Redis giữ bộ đếm rate limit. Mất nó nghĩa là các endpoint xác thực
            // không còn được bảo vệ, nên instance không nên nhận lưu lượng.
            await expect(createController(true, false).checkReadiness()).rejects.toThrow();
      });
});

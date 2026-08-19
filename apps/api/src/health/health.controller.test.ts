import { describe, expect, test, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function createController(databaseReachable: boolean): HealthController {
      const prisma = { isReachable: vi.fn().mockResolvedValue(databaseReachable) } as unknown as PrismaService;

      return new HealthController(prisma);
}

describe('HealthController', () => {
      test('healthz trả ok mà không chạm database', () => {
            expect(createController(false).checkLiveness()).toEqual({ status: 'ok' });
      });

      test('readyz trả ok khi database kết nối được', async () => {
            await expect(createController(true).checkReadiness()).resolves.toEqual({ status: 'ok', database: 'up' });
      });

      test('readyz ném lỗi khi database không kết nối được', async () => {
            // Chốt chặn quan trọng: bộ điều phối phải biết instance chưa sẵn sàng
            // nhận lưu lượng, thay vì nhận request rồi trả lỗi 500 cho khách.
            await expect(createController(false).checkReadiness()).rejects.toThrow();
      });
});

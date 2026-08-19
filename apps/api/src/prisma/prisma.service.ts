import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { loadEnv } from '../config/env.js';

/**
 * Quản lý vòng đời kết nối database theo vòng đời module của Nest.
 *
 * Từ Prisma 7, client nhận kết nối qua driver adapter thay vì đọc `url` trong
 * schema. Adapter dùng trình điều khiển `pg` chuẩn của Node, nên hành vi pool
 * kết nối là thứ đã được kiểm chứng rộng rãi thay vì lớp riêng của Prisma.
 *
 * Không để Prisma tự kết nối lười khi truy vấn đầu tiên: như vậy lỗi cấu hình
 * database chỉ lộ ra khi có request thật, thay vì lúc khởi động.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
      constructor() {
            const env = loadEnv();

            super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
      }

      async onModuleInit(): Promise<void> {
            await this.$connect();
      }

      async onModuleDestroy(): Promise<void> {
            await this.$disconnect();
      }

      /** Truy vấn rẻ nhất có thể để xác nhận kết nối còn sống. Dùng cho /readyz. */
      async isReachable(): Promise<boolean> {
            try {
                  await this.$queryRaw`SELECT 1`;
                  return true;
            } catch {
                  return false;
            }
      }
}

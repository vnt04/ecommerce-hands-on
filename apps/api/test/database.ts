import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Client dùng riêng cho test, trỏ tới container do global setup dựng lên.
 * Không dùng PrismaService vì service đọc cấu hình qua loadEnv, còn ở đây
 * chuỗi kết nối do Testcontainers sinh ra lúc chạy.
 */
export function createTestPrismaClient(): PrismaClient {
      const connectionString = process.env.DATABASE_URL;

      if (connectionString === undefined) {
            throw new Error('DATABASE_URL chưa được đặt. Test tích hợp phải chạy qua global setup.');
      }

      return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Xoá sạch dữ liệu giữa các test.
 *
 * TRUNCATE thay vì xoá từng bảng theo thứ tự: nhanh hơn nhiều và không phải tự
 * suy ra thứ tự khoá ngoại. RESTART IDENTITY để id bắt đầu lại từ 1, nhờ vậy
 * test không phụ thuộc vào việc đã có bao nhiêu bản ghi trước đó.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
      await prisma.$executeRawUnsafe(
            'TRUNCATE product_variants, product_images, products, categories, colors, sizes, size_charts RESTART IDENTITY CASCADE',
      );
}

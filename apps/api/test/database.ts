import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** Client có bật sự kiện truy vấn, để test đếm được số câu lệnh gửi xuống database. */
export type TestPrismaClient = PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>;

/**
 * Client dùng riêng cho test, trỏ tới container do global setup dựng lên.
 * Không dùng PrismaService vì service đọc cấu hình qua loadEnv, còn ở đây
 * chuỗi kết nối do Testcontainers sinh ra lúc chạy.
 */
export function createTestPrismaClient(): TestPrismaClient {
      const connectionString = process.env.DATABASE_URL;

      if (connectionString === undefined) {
            throw new Error('DATABASE_URL chưa được đặt. Test tích hợp phải chạy qua global setup.');
      }

      return new PrismaClient({
            adapter: new PrismaPg({ connectionString }),
            log: [{ emit: 'event', level: 'query' }],
      });
}

/**
 * Đếm số câu lệnh gửi xuống database trong lúc chạy một thao tác.
 *
 * Dùng để chốt chặn N+1: nếu số truy vấn tăng theo số bản ghi thì có ai đó đã đổi
 * cách truy vấn sang kiểu lặp, và test sẽ đỏ ngay thay vì để vấn đề lộ ra lúc
 * danh sách sản phẩm dài ra.
 */
export async function countQueries(prisma: TestPrismaClient, operation: () => Promise<unknown>): Promise<number> {
      let count = 0;
      const increment = (): void => {
            count += 1;
      };

      prisma.$on('query', increment);

      try {
            await operation();
      } finally {
            // Prisma không có API gỡ listener, nên client dùng để đếm chỉ nên dùng
            // trong phạm vi một test.
            prisma.$off?.('query', increment);
      }

      return count;
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

import { defineConfig } from 'vitest/config';

/**
 * Cấu hình riêng cho test tích hợp. Tách khỏi test đơn vị để lệnh `pnpm test`
 * chạy trong dưới một giây và không cần Docker.
 */
export default defineConfig({
      test: {
            include: ['src/**/*.int.test.ts'],
            globalSetup: ['./test/global-setup.ts'],
            // Dùng chung một database nên các tệp test phải chạy tuần tự,
            // nếu không thì việc dọn dữ liệu của tệp này xoá mất dữ liệu của tệp kia.
            fileParallelism: false,
            testTimeout: 30_000,
            hookTimeout: 120_000,
      },
});

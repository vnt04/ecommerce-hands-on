import { defineConfig } from 'vitest/config';

/**
 * Test đơn vị: chạy nhanh, không cần Docker, không cần database.
 * Test tích hợp nằm ở vitest.int.config.ts và chạy bằng `pnpm test:int`.
 */
export default defineConfig({
      test: {
            include: ['src/**/*.test.ts'],
            exclude: ['src/**/*.int.test.ts', '**/node_modules/**', '**/dist/**'],

            coverage: {
                  provider: 'v8',

                  /**
                   * Chỉ đo tầng logic nghiệp vụ thuần. Cố ý không đo main.ts, module
                   * và service: chúng chỉ có giá trị khi chạy thật, nên được kiểm bằng
                   * test tích hợp và bằng việc ứng dụng khởi động được, chứ không phải
                   * bằng một con số phần trăm.
                   *
                   * Đo cả những phần đó sẽ sinh ra áp lực viết test lấp chỗ cho đủ số,
                   * loại test không phát hiện được lỗi nào.
                   */
                  include: ['src/modules/**/domain/**', 'src/common/**'],
                  exclude: ['**/*.test.ts'],

                  thresholds: {
                        statements: 90,
                        branches: 90,
                        functions: 90,
                        lines: 90,
                  },
            },
      },
});

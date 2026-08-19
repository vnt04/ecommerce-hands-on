import { defineConfig } from 'vitest/config';

export default defineConfig({
      test: {
            coverage: {
                  provider: 'v8',

                  // envelope.ts chỉ khai báo kiểu nên không sinh mã lúc chạy.
                  include: ['src/**'],
                  exclude: ['**/*.test.ts', 'src/envelope.ts', 'src/index.ts'],

                  thresholds: {
                        statements: 90,
                        branches: 90,
                        functions: 90,
                        lines: 90,
                  },
            },
      },
});

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 không còn tự nạp tệp .env, và cũng bỏ trường `url` trong khối datasource
 * của schema. Chuỗi kết nối cho các lệnh migrate và introspect chuyển về đây, còn
 * client lúc chạy nhận kết nối qua driver adapter — xem src/prisma/prisma.service.ts.
 *
 * Hệ quả: phần lớn hướng dẫn Prisma trên mạng viết cho phiên bản 6 sẽ không khớp.
 */

/**
 * Nạp tệp .env nếu dotenv có mặt.
 *
 * Ở máy phát triển, cấu hình nằm trong .env ở gốc workspace — không nằm cạnh tệp
 * này — nên nạp theo đường dẫn tuyệt đối để lệnh chạy được bất kể đang đứng ở đâu.
 *
 * Trong ảnh production thì dotenv không tồn tại, vì nó là devDependency và biến
 * môi trường do nền tảng cấp thẳng. Bọc trong try để `prisma migrate deploy` chạy
 * được trong ảnh đó thay vì chết ngay ở bước nạp cấu hình.
 */
const configDirectory = dirname(fileURLToPath(import.meta.url));

try {
      const require = createRequire(import.meta.url);
      const dotenv = require('dotenv') as { config: (options: { path: string; quiet: boolean }) => unknown };

      dotenv.config({ path: resolve(configDirectory, '../../.env'), quiet: true });
} catch {
      // Không có dotenv: biến môi trường đã được nền tảng cấp sẵn.
}

export default defineConfig({
      schema: 'prisma/schema.prisma',
      datasource: {
            url: env('DATABASE_URL'),
      },
      migrations: {
            path: 'prisma/migrations',
            // Seed chạy từ mã đã biên dịch để dùng lại logic sinh ma trận trong src,
            // thay vì chép lại logic đó một lần nữa trong một tệp script riêng.
            seed: 'node dist/prisma/seed.js',
      },
});

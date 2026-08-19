import { config } from 'dotenv';
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

// Tệp .env nằm ở gốc workspace, không nằm cạnh tệp này. Nạp theo đường dẫn tuyệt đối
// để lệnh chạy được bất kể đang đứng ở thư mục nào.
const configDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(configDirectory, '../../.env'), quiet: true });

export default defineConfig({
      schema: 'prisma/schema.prisma',
      datasource: {
            url: env('DATABASE_URL'),
      },
      migrations: {
            path: 'prisma/migrations',
      },
});

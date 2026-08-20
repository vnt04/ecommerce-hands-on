import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Hợp đồng về biến môi trường. Ứng dụng đọc cấu hình qua đây, không đọc thẳng
 * process.env ở chỗ khác — nếu không thì một biến viết sai tên chỉ lộ ra khi
 * đúng nhánh mã đó chạy, có thể là nhiều ngày sau khi triển khai.
 */
const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
      LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

      DATABASE_URL: z
            .string()
            .min(1)
            .refine(
                  (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
                  'DATABASE_URL phải là chuỗi kết nối PostgreSQL',
            ),

      REDIS_URL: z
            .string()
            .min(1)
            .refine((value) => value.startsWith('redis://'), 'REDIS_URL phải là chuỗi kết nối Redis'),

      /**
       * Khoá ký access token. Đặt sàn độ dài để một giá trị đặt tạm lúc thử nghiệm
       * không lọt lên môi trường thật: khoá ngắn thì chữ ký đoán được.
       */
      JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH, 'JWT_SECRET phải dài ít nhất ' + MIN_JWT_SECRET_LENGTH + ' ký tự'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Kiểm tra toàn bộ biến môi trường một lần, trước khi ứng dụng khởi động.
 *
 * Ném lỗi thay vì trả về giá trị mặc định: thiếu cấu hình thì dừng ngay và ồn ào
 * còn hơn chạy tiếp rồi hỏng giữa chừng ở một nhánh không ai ngờ tới.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
      const result = envSchema.safeParse(source);

      if (!result.success) {
            const details = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');

            throw new Error(`Cấu hình môi trường không hợp lệ:\n${details}`);
      }

      return result.data;
}

import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Biến tuỳ chọn, hiểu chuỗi rỗng là không đặt.
 *
 * Docker Compose vẫn truyền biến bỏ trống xuống container dưới dạng chuỗi rỗng,
 * nên nếu không quy đổi thì mỗi lần không dùng một tính năng tuỳ chọn là một lần
 * ứng dụng từ chối khởi động.
 */
const optionalSecret = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

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

      /**
       * Kho ảnh nói giao thức S3. Ở môi trường phát triển đây là MinIO, ở production
       * là S3 thật — chỉ khác điểm cuối và cặp khoá, mã không đổi.
       *
       * S3_ENDPOINT rỗng nghĩa là dùng điểm cuối mặc định của AWS theo vùng.
       */
      S3_ENDPOINT: z.string().url().optional(),
      S3_REGION: z.string().min(1),
      S3_BUCKET: z.string().min(1),
      /**
       * Cặp khoá tĩnh, chỉ dùng ở môi trường phát triển với MinIO.
       *
       * Trên AWS thì bỏ trống: task lấy quyền từ IAM role gắn với nó, và SDK tự
       * tìm lấy. Cấp khoá tĩnh ở đó là tạo ra một thứ phải xoay vòng và phải giữ
       * bí mật, trong khi đã có sẵn cơ chế không cần cả hai.
       */
      S3_ACCESS_KEY_ID: z.string().min(1).optional(),
      S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),

      /**
       * Địa chỉ trình duyệt dùng để tải ảnh về. Khác S3_ENDPOINT vì hostname nội bộ
       * của Compose không phân giải được từ máy khách.
       */
      S3_PUBLIC_URL: z.string().url(),

      /**
       * Thông tin đăng nhập trang tài liệu API.
       *
       * Tài liệu liệt kê cả nhóm `/admin` nên ở production nó phải nằm sau một lớp
       * chặn; đặt được ở môi trường phát triển để thử chính lớp chặn đó, bỏ trống
       * thì trang mở tự do.
       */
      SWAGGER_USER: optionalSecret,
      SWAGGER_PASSWORD: optionalSecret,
});

/**
 * Production bắt buộc có thông tin đăng nhập trang tài liệu.
 *
 * Tắt tài liệu khi thiếu cấu hình sẽ là một khác biệt im lặng giữa hai môi trường:
 * trang biến mất mà không ai biết vì sao. Dừng khởi động thì lý do hiện ngay.
 */
const envSchemaWithDocsGuard = envSchema.refine(
      (value) => value.NODE_ENV !== 'production' || (value.SWAGGER_USER !== undefined && value.SWAGGER_PASSWORD !== undefined),
      { error: 'SWAGGER_USER và SWAGGER_PASSWORD là bắt buộc ở production', path: ['SWAGGER_USER'] },
);

export type Env = z.infer<typeof envSchema>;

/**
 * Kiểm tra toàn bộ biến môi trường một lần, trước khi ứng dụng khởi động.
 *
 * Ném lỗi thay vì trả về giá trị mặc định: thiếu cấu hình thì dừng ngay và ồn ào
 * còn hơn chạy tiếp rồi hỏng giữa chừng ở một nhánh không ai ngờ tới.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
      const result = envSchemaWithDocsGuard.safeParse(source);

      if (!result.success) {
            const details = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');

            throw new Error(`Cấu hình môi trường không hợp lệ:\n${details}`);
      }

      return result.data;
}

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject, type SchemaObject } from '@nestjs/swagger';
import { toComponentSchemas } from '@shopflow/shared';

import type { Env } from '../../config/env.js';
import { docsBasicAuth } from './docs-basic-auth.js';

/** Tên định danh của các lược đồ xác thực, dùng lại ở decorator của controller. */
export const BEARER_AUTH = 'accessToken';
export const REFRESH_COOKIE_AUTH = 'refreshCookie';
export const CART_COOKIE_AUTH = 'cartCookie';

const DOCS_PATH = 'docs';

const DESCRIPTION = [
      'Hợp đồng HTTP của ShopFlow.',
      '',
      'Mọi response bọc trong một vỏ chung: `{ success: true, data }` khi thành công,',
      '`{ success: false, error: { code, message } }` khi thất bại. Client phân nhánh theo `error.code`,',
      'không theo `error.message`.',
      '',
      'Mọi số tiền là chuỗi chữ số, đơn vị đồng (ràng buộc R1, ADR-003).',
].join('\n');

/**
 * Dựng và gắn trang tài liệu.
 *
 * Tài liệu dựng ngay lúc khởi động chứ không dựng lười khi có người mở trang: một
 * schema không chuyển đổi được sẽ làm tiến trình chết ngay lúc triển khai, thay vì
 * nằm im tới lần đầu ai đó mở tài liệu.
 */
export function setupSwagger(app: INestApplication, env: Env, apiPrefix: string): void {
      const docsPathPrefix = `/${apiPrefix}/${DOCS_PATH}`;

      if (env.SWAGGER_USER !== undefined && env.SWAGGER_PASSWORD !== undefined) {
            app.use(docsBasicAuth(docsPathPrefix, { user: env.SWAGGER_USER, password: env.SWAGGER_PASSWORD }));
      }

      SwaggerModule.setup(DOCS_PATH, app, buildDocument(app), {
            useGlobalPrefix: true,
            swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
      });
}

function buildDocument(app: INestApplication): OpenAPIObject {
      const config = new DocumentBuilder()
            .setTitle('ShopFlow API')
            .setDescription(DESCRIPTION)
            .setVersion('v1')
            .addBearerAuth(
                  { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token nhận từ /auth/login' },
                  BEARER_AUTH,
            )
            .addCookieAuth('refresh_token', { type: 'apiKey', description: 'Cookie httpOnly cấp khi đăng nhập' }, REFRESH_COOKIE_AUTH)
            .addCookieAuth('cart_token', { type: 'apiKey', description: 'Cookie giỏ hàng của khách chưa đăng nhập' }, CART_COOKIE_AUTH)
            .addTag('Sức khoẻ', 'Kiểm tra sống và kiểm tra sẵn sàng')
            .addTag('Tài khoản', 'Đăng ký, đăng nhập và phiên làm việc')
            .addTag('Catalog', 'Duyệt thiết kế, công khai với mọi khách')
            .addTag('Giỏ hàng', 'Phục vụ cả khách chưa đăng nhập')
            .addTag('Đơn hàng', 'Đặt hàng và theo dõi đơn của chính mình')
            .addTag('Quản trị đơn hàng', 'Dành cho vai trò ADMIN')
            .addTag('Quản trị sản phẩm', 'Dành cho vai trò ADMIN')
            .build();

      const document = SwaggerModule.createDocument(app, config);

      /**
       * Ghép schema dùng chung từ `@shopflow/shared` vào tài liệu.
       *
       * Chúng sinh ra từ Zod chứ không từ decorator nên `createDocument` không thấy;
       * ghép ở đây để endpoint tham chiếu tới `components.schemas` thay vì lặp lại
       * cùng một định nghĩa ở hàng chục đường dẫn.
       */
      return {
            ...document,
            components: {
                  ...document.components,
                  schemas: { ...document.components?.schemas, ...(toComponentSchemas() as Record<string, SchemaObject>) },
            },
      };
}

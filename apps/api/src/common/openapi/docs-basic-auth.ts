import { HttpStatus } from '@nestjs/common';
import { DEFAULT_ERROR_MESSAGES, ERROR_CODES, type ErrorEnvelope } from '@shopflow/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

const BASIC_PREFIX = 'Basic ';
const REALM = 'ShopFlow API docs';

type Credentials = { user: string; password: string };

/**
 * Chặn trang tài liệu bằng Basic Auth.
 *
 * Viết ở tầng Express chứ không phải guard của Nest: `SwaggerModule` tự phục vụ
 * trang tĩnh và tệp JSON bên ngoài vòng đời controller, nên guard không chạm tới.
 *
 * Phạm vi chặn tính theo tiền tố đường dẫn, không so bằng: ngoài chính trang tài
 * liệu còn có `<đường dẫn>-json` và `<đường dẫn>-yaml`, và bỏ sót chúng nghĩa là
 * toàn bộ hợp đồng API vẫn tải về được mà không cần đăng nhập.
 */
export function docsBasicAuth(pathPrefix: string, credentials: Credentials): RequestHandler {
      return (request: Request, response: Response, next: NextFunction): void => {
            if (!request.path.startsWith(pathPrefix)) {
                  next();

                  return;
            }

            if (isAuthorized(request.headers.authorization, credentials)) {
                  next();

                  return;
            }

            const body: ErrorEnvelope = {
                  success: false,
                  error: { code: ERROR_CODES.UNAUTHORIZED, message: DEFAULT_ERROR_MESSAGES.UNAUTHORIZED },
            };

            response.setHeader('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`);
            response.status(HttpStatus.UNAUTHORIZED).json(body);
      };
}

function isAuthorized(header: string | undefined, credentials: Credentials): boolean {
      if (header === undefined || !header.startsWith(BASIC_PREFIX)) {
            return false;
      }

      const decoded = Buffer.from(header.slice(BASIC_PREFIX.length), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');

      if (separator === -1) {
            return false;
      }

      // Hai phép so sánh luôn chạy đủ: thoát sớm ở tên đăng nhập cho biết tên nào đúng.
      const userMatches = equalsInConstantTime(decoded.slice(0, separator), credentials.user);
      const passwordMatches = equalsInConstantTime(decoded.slice(separator + 1), credentials.password);

      return userMatches && passwordMatches;
}

/** So sánh không phụ thuộc vị trí ký tự sai, để không đo được từng ký tự qua thời gian phản hồi. */
function equalsInConstantTime(actual: string, expected: string): boolean {
      const actualBytes = Buffer.from(actual, 'utf8');
      const expectedBytes = Buffer.from(expected, 'utf8');

      return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

import type { NextFunction, Request, Response } from 'express';
import { describe, expect, test, vi } from 'vitest';

import { docsBasicAuth } from './docs-basic-auth.js';

const CREDENTIALS = { user: 'docs', password: 'mat-khau' };
const DOCS_PREFIX = '/api/v1/docs';

function basicHeader(user: string, password: string): string {
      return 'Basic ' + Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
}

function fakeResponse(): Response {
      const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };

      response.status.mockReturnValue(response);

      return response as unknown as Response;
}

function call(path: string, authorization?: string): { response: Response; next: NextFunction } {
      const request = { path, headers: { authorization } } as unknown as Request;
      const response = fakeResponse();
      const next = vi.fn() as unknown as NextFunction;

      docsBasicAuth(DOCS_PREFIX, CREDENTIALS)(request, response, next);

      return { response, next };
}

describe('docsBasicAuth', () => {
      test('bỏ qua đường dẫn không thuộc trang tài liệu', () => {
            const { next, response } = call('/api/v1/products');

            expect(next).toHaveBeenCalledOnce();
            expect(response.status).not.toHaveBeenCalled();
      });

      /** Bỏ sót hai đường dẫn này là để lộ toàn bộ hợp đồng API mà không cần đăng nhập. */
      test.each(['/api/v1/docs', '/api/v1/docs/', '/api/v1/docs-json', '/api/v1/docs-yaml'])(
            'chặn %s khi thiếu thông tin đăng nhập',
            (path) => {
                  const { next, response } = call(path);

                  expect(next).not.toHaveBeenCalled();
                  expect(response.status).toHaveBeenCalledWith(401);
            },
      );

      test('cho qua khi thông tin đăng nhập đúng', () => {
            const { next, response } = call(DOCS_PREFIX, basicHeader('docs', 'mat-khau'));

            expect(next).toHaveBeenCalledOnce();
            expect(response.status).not.toHaveBeenCalled();
      });

      test.each([
            ['sai mật khẩu', basicHeader('docs', 'mat-khau-khac')],
            ['sai tên đăng nhập', basicHeader('khach', 'mat-khau')],
            ['mật khẩu khác độ dài', basicHeader('docs', 'ngan')],
            ['không phải lược đồ Basic', 'Bearer mot-token'],
            ['base64 không có dấu hai chấm', 'Basic ' + Buffer.from('khongcodauhaicham', 'utf8').toString('base64')],
      ])('từ chối khi %s', (_label, authorization) => {
            const { next, response } = call(DOCS_PREFIX, authorization);

            expect(next).not.toHaveBeenCalled();
            expect(response.status).toHaveBeenCalledWith(401);
      });

      test('trả về đúng vỏ bọc lỗi của dự án', () => {
            const { response } = call(DOCS_PREFIX);

            expect(response.json).toHaveBeenCalledWith({
                  success: false,
                  error: { code: 'UNAUTHORIZED', message: 'Bạn cần đăng nhập để thực hiện thao tác này' },
            });
      });

      /** Thiếu header này thì trình duyệt không hiện hộp đăng nhập, chỉ báo lỗi trống. */
      test('gửi kèm WWW-Authenticate để trình duyệt hiện hộp đăng nhập', () => {
            const { response } = call(DOCS_PREFIX);

            expect(response.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="ShopFlow API docs", charset="UTF-8"');
      });

      test('mật khẩu chứa dấu hai chấm vẫn đăng nhập được', () => {
            const request = { path: DOCS_PREFIX, headers: { authorization: basicHeader('docs', 'a:b:c') } } as unknown as Request;
            const next = vi.fn() as unknown as NextFunction;

            docsBasicAuth(DOCS_PREFIX, { user: 'docs', password: 'a:b:c' })(request, fakeResponse(), next);

            expect(next).toHaveBeenCalledOnce();
      });
});

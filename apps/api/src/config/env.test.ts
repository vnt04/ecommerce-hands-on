import { describe, expect, test } from 'vitest';

import { loadEnv } from './env.js';

const VALID = {
      DATABASE_URL: 'postgres://shopflow@db:5432/shopflow',
      REDIS_URL: 'redis://redis:6379',
      JWT_SECRET: 'a'.repeat(32),
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'shopflow-images',
      S3_PUBLIC_URL: 'http://localhost:9000',
};

describe('loadEnv', () => {
      test('trang tài liệu để mở khi không đặt thông tin đăng nhập', () => {
            const env = loadEnv({ ...VALID });

            expect(env.SWAGGER_USER).toBeUndefined();
      });

      /**
       * Compose truyền biến bỏ trống xuống dưới dạng chuỗi rỗng. Không quy đổi thì
       * mỗi lần không dùng tính năng tuỳ chọn là một lần ứng dụng từ chối khởi động.
       */
      test('hiểu chuỗi rỗng là không đặt', () => {
            const env = loadEnv({ ...VALID, SWAGGER_USER: '', SWAGGER_PASSWORD: '' });

            expect([env.SWAGGER_USER, env.SWAGGER_PASSWORD]).toEqual([undefined, undefined]);
      });

      /** Tài liệu liệt kê cả nhóm /admin nên ở production không được để công khai. */
      test.each([
            ['thiếu cả hai', {}],
            ['thiếu mật khẩu', { SWAGGER_USER: 'docs' }],
            ['thiếu tên đăng nhập', { SWAGGER_PASSWORD: 'mat-khau' }],
      ])('production từ chối khởi động khi %s', (_label, partial) => {
            expect(() => loadEnv({ ...VALID, NODE_ENV: 'production', ...partial })).toThrow(/SWAGGER_USER/);
      });

      test('production khởi động khi có đủ thông tin đăng nhập', () => {
            const env = loadEnv({ ...VALID, NODE_ENV: 'production', SWAGGER_USER: 'docs', SWAGGER_PASSWORD: 'mat-khau' });

            expect(env.SWAGGER_USER).toBe('docs');
      });

      test('nêu đúng tên biến thiếu trong thông báo lỗi', () => {
            expect(() => loadEnv({ ...VALID, JWT_SECRET: 'qua-ngan' })).toThrow(/JWT_SECRET/);
      });
});

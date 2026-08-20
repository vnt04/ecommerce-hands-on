import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import { describe, expect, test } from 'vitest';

import { JwtAuthGuard, RolesGuard } from './auth.guards.js';
import { IS_PUBLIC_KEY, REQUIRED_ROLES_KEY } from './auth.decorators.js';

const SECRET = 'khoa-ky-danh-cho-test-du-dai-32-ky-tu';
const jwt = new JwtService({ secret: SECRET });

type RequestLike = { headers: Record<string, string>; user?: { role: UserRole } };

function createContext(request: RequestLike): ExecutionContext {
      return {
            switchToHttp: () => ({ getRequest: () => request }),
            getHandler: () => undefined,
            getClass: () => undefined,
      } as unknown as ExecutionContext;
}

function createReflector(metadata: Record<string, unknown>): Reflector {
      return { getAllAndOverride: (key: string) => metadata[key] } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
      test('chặn request không có token', async () => {
            const guard = new JwtAuthGuard(createReflector({}), jwt);

            await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toThrow();
      });

      test('cho qua endpoint đánh dấu công khai', async () => {
            // Mặc định chặn: quên đánh dấu thì endpoint trả 401, lỗi ồn ào và thấy ngay.
            // Chiều ngược lại, mặc định cho qua rồi quên bảo vệ, là lỗ hổng im lặng.
            const guard = new JwtAuthGuard(createReflector({ [IS_PUBLIC_KEY]: true }), jwt);

            await expect(guard.canActivate(createContext({ headers: {} }))).resolves.toBe(true);
      });

      test('chặn token ký bằng khoá khác', async () => {
            const foreign = new JwtService({ secret: 'khoa-khac-cung-du-dai-32-ky-tu-nhe' });
            const token = await foreign.signAsync({ email: 'a@b.co', role: 'CUSTOMER' }, { subject: '1' });
            const guard = new JwtAuthGuard(createReflector({}), jwt);

            await expect(guard.canActivate(createContext({ headers: { authorization: 'Bearer ' + token } }))).rejects.toThrow();
      });

      test('chặn token đã hết hạn', async () => {
            const token = await jwt.signAsync({ email: 'a@b.co', role: 'CUSTOMER' }, { subject: '1', expiresIn: '-1s' });
            const guard = new JwtAuthGuard(createReflector({}), jwt);

            await expect(guard.canActivate(createContext({ headers: { authorization: 'Bearer ' + token } }))).rejects.toThrow();
      });

      test('chặn header sai định dạng', async () => {
            const guard = new JwtAuthGuard(createReflector({}), jwt);

            await expect(guard.canActivate(createContext({ headers: { authorization: 'Token abc' } }))).rejects.toThrow();
      });

      test('gắn danh tính vào request khi token hợp lệ', async () => {
            const token = await jwt.signAsync({ email: 'khach@example.com', role: 'CUSTOMER' }, { subject: '42' });
            const request: RequestLike = { headers: { authorization: 'Bearer ' + token } };

            await new JwtAuthGuard(createReflector({}), jwt).canActivate(createContext(request));

            expect(request.user).toMatchObject({ email: 'khach@example.com', role: 'CUSTOMER' });
      });
});

describe('RolesGuard', () => {
      test('cho qua khi endpoint không yêu cầu vai trò nào', () => {
            const guard = new RolesGuard(createReflector({}));

            expect(guard.canActivate(createContext({ headers: {}, user: { role: 'CUSTOMER' } }))).toBe(true);
      });

      test('cho qua khi vai trò khớp', () => {
            const guard = new RolesGuard(createReflector({ [REQUIRED_ROLES_KEY]: ['ADMIN'] }));

            expect(guard.canActivate(createContext({ headers: {}, user: { role: 'ADMIN' } }))).toBe(true);
      });

      test('chặn khi tài khoản khách gọi endpoint dành cho quản trị', () => {
            const guard = new RolesGuard(createReflector({ [REQUIRED_ROLES_KEY]: ['ADMIN'] }));

            expect(() => guard.canActivate(createContext({ headers: {}, user: { role: 'CUSTOMER' } }))).toThrow();
      });

      test('chặn khi request chưa có danh tính', () => {
            const guard = new RolesGuard(createReflector({ [REQUIRED_ROLES_KEY]: ['ADMIN'] }));

            expect(() => guard.canActivate(createContext({ headers: {} }))).toThrow();
      });
});

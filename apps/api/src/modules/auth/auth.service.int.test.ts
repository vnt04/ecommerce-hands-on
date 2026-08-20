import { JwtService } from '@nestjs/jwt';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createTestPrismaClient, resetDatabase, type TestPrismaClient } from '../../../test/database.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './domain/password.service.js';

const CREDENTIALS = { email: 'khach@example.com', password: 'matkhau12345', fullName: 'Nguyễn Văn A' };

let prisma: TestPrismaClient;
let auth: AuthService;

beforeAll(() => {
      prisma = createTestPrismaClient();
      auth = new AuthService(
            prisma as unknown as PrismaService,
            new PasswordService(),
            new JwtService({ secret: 'khoa-ky-danh-cho-test-du-dai-32-ky-tu' }),
      );
});

afterAll(async () => {
      await prisma.$disconnect();
});

beforeEach(async () => {
      await prisma.$executeRawUnsafe('TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE');
      await resetDatabase(prisma);
});

describe('register', () => {
      test('lưu chuỗi băm chứ không lưu mật khẩu', async () => {
            const user = await auth.register(CREDENTIALS);
            const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

            expect(stored.passwordHash).not.toBe(CREDENTIALS.password);
            expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      });

      test('tài khoản mới luôn là khách, không phải quản trị', async () => {
            // Không có đường tự đăng ký thành ADMIN.
            expect((await auth.register(CREDENTIALS)).role).toBe('CUSTOMER');
      });

      test('từ chối email đã tồn tại', async () => {
            await auth.register(CREDENTIALS);

            await expect(auth.register(CREDENTIALS)).rejects.toThrow();
      });
});

describe('validateCredentials', () => {
      test('trả về tài khoản khi mật khẩu đúng', async () => {
            await auth.register(CREDENTIALS);

            await expect(auth.validateCredentials(CREDENTIALS.email, CREDENTIALS.password)).resolves.toMatchObject({
                  email: CREDENTIALS.email,
            });
      });

      test('email không tồn tại và mật khẩu sai ném cùng một loại lỗi', async () => {
            // Phân biệt hai trường hợp là cho phép dò xem email nào có trong hệ thống.
            await auth.register(CREDENTIALS);

            const wrongPassword = await auth.validateCredentials(CREDENTIALS.email, 'sai').catch((error: Error) => error);
            const unknownEmail = await auth.validateCredentials('khong-co@example.com', 'sai').catch((error: Error) => error);

            expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message);
      });
});

describe('rotateSession', () => {
      test('cấp cặp token mới và thu hồi token cũ', async () => {
            const user = await auth.register(CREDENTIALS);
            const first = await auth.startSession(user);

            const second = await auth.rotateSession(first.refreshToken);

            expect(second.refreshToken).not.toBe(first.refreshToken);
            await expect(prisma.refreshToken.count({ where: { revokedAt: { not: null } } })).resolves.toBe(1);
      });

      test('dùng lại token đã bị thay thế sẽ thu hồi toàn bộ họ token', async () => {
            // Không phân biệt được token bị đánh cắp với client gọi refresh song song,
            // nên xử lý theo hướng an toàn: huỷ cả phiên.
            const user = await auth.register(CREDENTIALS);
            const first = await auth.startSession(user);
            const second = await auth.rotateSession(first.refreshToken);

            await expect(auth.rotateSession(first.refreshToken)).rejects.toThrow();

            // Token mới cũng mất hiệu lực theo.
            await expect(auth.rotateSession(second.refreshToken)).rejects.toThrow();
      });

      test('từ chối token không tồn tại', async () => {
            await expect(auth.rotateSession('token-bia-dat')).rejects.toThrow();
      });

      test('từ chối token đã hết hạn', async () => {
            const user = await auth.register(CREDENTIALS);
            const session = await auth.startSession(user);

            await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

            await expect(auth.rotateSession(session.refreshToken)).rejects.toThrow();
      });

      test('giữ nguyên mã họ qua nhiều lần xoay vòng', async () => {
            const user = await auth.register(CREDENTIALS);
            const first = await auth.startSession(user);
            await auth.rotateSession(first.refreshToken);

            const families = await prisma.refreshToken.findMany({ select: { familyId: true }, distinct: ['familyId'] });

            expect(families).toHaveLength(1);
      });
});

describe('endSession', () => {
      test('thu hồi cả họ token để mọi thiết bị của phiên mất hiệu lực', async () => {
            const user = await auth.register(CREDENTIALS);
            const session = await auth.startSession(user);

            await auth.endSession(session.refreshToken);

            await expect(auth.rotateSession(session.refreshToken)).rejects.toThrow();
      });

      test('không ném lỗi khi token không tồn tại', async () => {
            // Đăng xuất phải luôn thành công với người dùng, kể cả khi cookie đã cũ.
            await expect(auth.endSession('token-bia-dat')).resolves.toBeUndefined();
      });
});

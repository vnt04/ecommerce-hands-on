import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from './domain/password.service.js';
import { hashRefreshToken, issueRefreshToken } from './domain/refresh-token.js';

export type AuthenticatedUser = {
      id: bigint;
      email: string;
      fullName: string;
      role: UserRole;
};

export type SessionTokens = {
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
};

/** Access token sống ngắn: thu hồi tức thì không làm được, nên giảm cửa sổ rủi ro. */
const ACCESS_TOKEN_TTL = '15m';

@Injectable()
export class AuthService {
      constructor(
            private readonly prisma: PrismaService,
            private readonly passwords: PasswordService,
            private readonly jwt: JwtService,
      ) {}

      async register(input: { email: string; password: string; fullName: string }): Promise<AuthenticatedUser> {
            const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });

            if (existing !== null) {
                  // Không nêu rõ "email đã tồn tại" trong thông báo trả ra ngoài;
                  // mã lỗi đủ để giao diện hướng dẫn người dùng.
                  throw new ConflictException('Không tạo được tài khoản');
            }

            const user = await this.prisma.user.create({
                  data: {
                        email: input.email,
                        passwordHash: await this.passwords.hash(input.password),
                        fullName: input.fullName,
                  },
                  select: { id: true, email: true, fullName: true, role: true },
            });

            return user;
      }

      /**
       * Xác thực bằng email và mật khẩu.
       *
       * Email không tồn tại và mật khẩu sai trả về cùng một lỗi: phân biệt hai
       * trường hợp là cho phép dò xem email nào có trong hệ thống. Vì cùng lý do,
       * nhánh không tìm thấy email vẫn chạy một lượt so khớp giả để thời gian phản
       * hồi không chênh lệch.
       */
      async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
            const user = await this.prisma.user.findUnique({
                  where: { email },
                  select: { id: true, email: true, fullName: true, role: true, passwordHash: true },
            });

            if (user === null) {
                  await this.passwords.verifyAgainstDummy(password);
                  throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
            }

            if (!(await this.passwords.verify(password, user.passwordHash))) {
                  throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
            }

            return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
      }

      /** Cấp cặp token mới cho một lần đăng nhập. */
      async startSession(user: AuthenticatedUser): Promise<SessionTokens> {
            const issued = issueRefreshToken();

            await this.prisma.refreshToken.create({
                  data: {
                        userId: user.id,
                        tokenHash: issued.tokenHash,
                        familyId: issued.familyId,
                        expiresAt: issued.expiresAt,
                  },
            });

            return {
                  accessToken: await this.signAccessToken(user),
                  refreshToken: issued.token,
                  refreshTokenExpiresAt: issued.expiresAt,
            };
      }

      /**
       * Xoay vòng refresh token.
       *
       * Dùng lại một token đã bị thay thế nghĩa là hoặc token bị đánh cắp, hoặc
       * client gọi refresh nhiều lần song song. Không phân biệt được hai trường hợp
       * đó, nên xử lý theo hướng an toàn: thu hồi toàn bộ họ token của phiên.
       *
       * Hệ quả với frontend: nhiều request cùng nhận 401 phải gộp về một lần gọi
       * refresh, nếu không người dùng bị đăng xuất dù không làm gì sai.
       */
      async rotateSession(refreshToken: string): Promise<SessionTokens> {
            const tokenHash = hashRefreshToken(refreshToken);

            const stored = await this.prisma.refreshToken.findUnique({
                  where: { tokenHash },
                  select: {
                        id: true,
                        familyId: true,
                        revokedAt: true,
                        expiresAt: true,
                        user: { select: { id: true, email: true, fullName: true, role: true } },
                  },
            });

            if (stored === null) {
                  throw new UnauthorizedException('Phiên không hợp lệ');
            }

            if (stored.revokedAt !== null) {
                  await this.revokeFamily(stored.familyId);
                  throw new UnauthorizedException('Phiên không hợp lệ');
            }

            if (stored.expiresAt.getTime() <= Date.now()) {
                  throw new UnauthorizedException('Phiên đã hết hạn');
            }

            const issued = issueRefreshToken(stored.familyId);

            await this.prisma.$transaction([
                  this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
                  this.prisma.refreshToken.create({
                        data: {
                              userId: stored.user.id,
                              tokenHash: issued.tokenHash,
                              familyId: issued.familyId,
                              expiresAt: issued.expiresAt,
                        },
                  }),
            ]);

            return {
                  accessToken: await this.signAccessToken(stored.user),
                  refreshToken: issued.token,
                  refreshTokenExpiresAt: issued.expiresAt,
            };
      }

      /** Đăng xuất: thu hồi cả họ token để mọi thiết bị của phiên đó mất hiệu lực. */
      async endSession(refreshToken: string): Promise<void> {
            const stored = await this.prisma.refreshToken.findUnique({
                  where: { tokenHash: hashRefreshToken(refreshToken) },
                  select: { familyId: true },
            });

            if (stored !== null) {
                  await this.revokeFamily(stored.familyId);
            }
      }

      async findById(userId: bigint): Promise<AuthenticatedUser | null> {
            return this.prisma.user.findUnique({
                  where: { id: userId },
                  select: { id: true, email: true, fullName: true, role: true },
            });
      }

      private async revokeFamily(familyId: string): Promise<void> {
            await this.prisma.refreshToken.updateMany({
                  where: { familyId, revokedAt: null },
                  data: { revokedAt: new Date() },
            });
      }

      private async signAccessToken(user: AuthenticatedUser): Promise<string> {
            return this.jwt.signAsync({ email: user.email, role: user.role }, { subject: user.id.toString(), expiresIn: ACCESS_TOKEN_TTL });
      }
}

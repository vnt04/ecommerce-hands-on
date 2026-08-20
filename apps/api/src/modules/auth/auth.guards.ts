import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

import { type AuthenticatedUser } from './auth.service.js';
import { IS_PUBLIC_KEY, REQUIRED_ROLES_KEY } from './auth.decorators.js';

type AccessTokenPayload = {
      sub: string;
      email: string;
      role: UserRole;
};

function readBearerToken(request: Request): string | undefined {
      const header = request.headers.authorization;

      if (header === undefined || !header.startsWith('Bearer ')) {
            return undefined;
      }

      return header.slice('Bearer '.length);
}

/**
 * Guard xác thực toàn cục: mặc định chặn, endpoint công khai phải khai báo tường minh.
 *
 * Danh tính đọc thẳng từ access token nên không tốn một truy vấn database cho mỗi
 * request. Đổi lại, token bị lộ vẫn dùng được cho tới khi hết hạn — đó là lý do
 * access token chỉ sống mười lăm phút và việc thu hồi nằm ở tầng refresh token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
      constructor(
            private readonly reflector: Reflector,
            private readonly jwt: JwtService,
      ) {}

      async canActivate(context: ExecutionContext): Promise<boolean> {
            const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

            if (isPublic === true) {
                  return true;
            }

            const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
            const token = readBearerToken(request);

            if (token === undefined) {
                  throw new UnauthorizedException('Thiếu access token');
            }

            let payload: AccessTokenPayload;

            try {
                  payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
            } catch {
                  throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn');
            }

            request.user = {
                  id: BigInt(payload.sub),
                  email: payload.email,
                  fullName: '',
                  role: payload.role,
            };

            return true;
      }
}

/** Kiểm tra vai trò. Chạy sau JwtAuthGuard nên request.user luôn có sẵn. */
@Injectable()
export class RolesGuard implements CanActivate {
      constructor(private readonly reflector: Reflector) {}

      canActivate(context: ExecutionContext): boolean {
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES_KEY, [
                  context.getHandler(),
                  context.getClass(),
            ]);

            if (requiredRoles === undefined || requiredRoles.length === 0) {
                  return true;
            }

            const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

            if (request.user === undefined || !requiredRoles.includes(request.user.role)) {
                  throw new ForbiddenException('Không đủ quyền thực hiện thao tác này');
            }

            return true;
      }
}

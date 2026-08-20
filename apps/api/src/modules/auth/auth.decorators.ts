import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

import type { AuthenticatedUser } from './auth.service.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRED_ROLES_KEY = 'requiredRoles';

/**
 * Đánh dấu endpoint không cần đăng nhập.
 *
 * Guard mặc định chặn tất cả, nên quên đánh dấu thì endpoint trả 401 — lỗi ồn ào
 * và phát hiện ngay. Chiều ngược lại, mặc định cho qua rồi quên bảo vệ, là một lỗ
 * hổng im lặng không ai thấy cho tới khi bị khai thác.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
      const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

      if (request.user === undefined) {
            throw new Error('CurrentUser dùng trên endpoint không có guard xác thực');
      }

      return request.user;
});

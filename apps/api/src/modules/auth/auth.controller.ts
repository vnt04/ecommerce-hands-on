import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { AuthService, type AuthenticatedUser, type SessionTokens } from './auth.service.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './dto/auth.schema.js';

const REFRESH_COOKIE = 'refresh_token';

/** Giới hạn chặt cho các endpoint dò được: năm lần mỗi phút cho mỗi địa chỉ. */
const AUTH_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } };

type PublicUser = { id: string; email: string; fullName: string; role: string };
type SessionResponse = { accessToken: string; user: PublicUser };

function toPublicUser(user: AuthenticatedUser): PublicUser {
      // id là bigint và không có ý nghĩa với client; trả về dạng chuỗi cho nhất quán.
      return { id: user.id.toString(), email: user.email, fullName: user.fullName, role: user.role };
}

@Controller('auth')
export class AuthController {
      constructor(private readonly auth: AuthService) {}

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('register')
      async register(
            @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
            @Res({ passthrough: true }) response: Response,
      ): Promise<SessionResponse> {
            const user = await this.auth.register(input);
            const tokens = await this.auth.startSession(user);

            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken, user: toPublicUser(user) };
      }

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('login')
      @HttpCode(HttpStatus.OK)
      async login(
            @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
            @Res({ passthrough: true }) response: Response,
      ): Promise<SessionResponse> {
            const user = await this.auth.validateCredentials(input.email, input.password);
            const tokens = await this.auth.startSession(user);

            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken, user: toPublicUser(user) };
      }

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('refresh')
      @HttpCode(HttpStatus.OK)
      async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ accessToken: string }> {
            const tokens = await this.auth.rotateSession(this.readRefreshCookie(request));

            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken };
      }

      @Public()
      @Post('logout')
      @HttpCode(HttpStatus.NO_CONTENT)
      async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
            const token = request.cookies?.[REFRESH_COOKIE];

            if (typeof token === 'string') {
                  await this.auth.endSession(token);
            }

            response.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      }

      @Get('me')
      async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
            // Guard chỉ dựng danh tính từ token nên chưa có họ tên; đọc lại từ database.
            const fresh = await this.auth.findById(user.id);

            if (fresh === null) {
                  throw new UnauthorizedException('Tài khoản không còn tồn tại');
            }

            return toPublicUser(fresh);
      }

      private readRefreshCookie(request: Request): string {
            const token = request.cookies?.[REFRESH_COOKIE];

            if (typeof token !== 'string' || token === '') {
                  throw new UnauthorizedException('Thiếu refresh token');
            }

            return token;
      }

      /**
       * Refresh token nằm trong cookie httpOnly, không nằm trong response body.
       *
       * Script XSS đọc được mọi thứ JavaScript chạm tới, kể cả localStorage và
       * biến trong bộ nhớ. Cookie httpOnly là thứ duy nhất nó không đọc được.
       *
       * path giới hạn ở nhánh auth để cookie không đi kèm mọi request khác.
       */
      private setRefreshCookie(response: Response, tokens: SessionTokens): void {
            response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
                  httpOnly: true,
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production',
                  path: '/api/v1/auth',
                  expires: tokens.refreshTokenExpiresAt,
            });
      }
}

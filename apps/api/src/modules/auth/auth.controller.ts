import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ApiEnvelope, ApiErrors } from '../../common/openapi/envelope-response.decorator.js';
import { BEARER_AUTH, REFRESH_COOKIE_AUTH } from '../../common/openapi/swagger.js';
import { ApiZodBody } from '../../common/openapi/zod-request.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CartService } from '../cart/cart.service.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { AuthService, type AuthenticatedUser, type SessionTokens } from './auth.service.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './dto/auth.schema.js';
import { accessTokenSchema, publicUserSchema, sessionSchema, type PublicUser, type SessionResponse } from './dto/session.schema.js';

const REFRESH_COOKIE = 'refresh_token';
const CART_COOKIE = 'cart_token';

/** Giới hạn chặt cho các endpoint dò được: năm lần mỗi phút cho mỗi địa chỉ. */
const AUTH_RATE_LIMIT = { default: { limit: 5, ttl: 60_000 } };

const MERGES_GUEST_CART = 'Giỏ hàng ẩn danh trong cookie `cart_token` được gộp vào giỏ tài khoản, và cookie đó bị xoá sau khi gộp.';

function toPublicUser(user: AuthenticatedUser): PublicUser {
      // id là bigint và không có ý nghĩa với client; trả về dạng chuỗi cho nhất quán.
      return { id: user.id.toString(), email: user.email, fullName: user.fullName, role: user.role };
}

@ApiTags('Tài khoản')
@Controller('auth')
export class AuthController {
      constructor(
            private readonly auth: AuthService,
            private readonly carts: CartService,
      ) {}

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('register')
      @ApiOperation({ summary: 'Đăng ký tài khoản', description: MERGES_GUEST_CART })
      @ApiZodBody(registerSchema)
      @ApiEnvelope(sessionSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
      async register(
            @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
            @Req() request: Request,
            @Res({ passthrough: true }) response: Response,
      ): Promise<SessionResponse> {
            const user = await this.auth.register(input);
            const tokens = await this.auth.startSession(user);

            await this.mergeGuestCart(request, response, user.id);
            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken, user: toPublicUser(user) };
      }

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('login')
      @HttpCode(HttpStatus.OK)
      @ApiOperation({ summary: 'Đăng nhập', description: MERGES_GUEST_CART })
      @ApiZodBody(loginSchema)
      @ApiEnvelope(sessionSchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
      async login(
            @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
            @Req() request: Request,
            @Res({ passthrough: true }) response: Response,
      ): Promise<SessionResponse> {
            const user = await this.auth.validateCredentials(input.email, input.password);
            const tokens = await this.auth.startSession(user);

            await this.mergeGuestCart(request, response, user.id);
            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken, user: toPublicUser(user) };
      }

      @Public()
      @Throttle(AUTH_RATE_LIMIT)
      @Post('refresh')
      @HttpCode(HttpStatus.OK)
      @ApiCookieAuth(REFRESH_COOKIE_AUTH)
      @ApiOperation({ summary: 'Làm mới access token', description: 'Đọc refresh token từ cookie và cấp lại cả cặp token.' })
      @ApiEnvelope(accessTokenSchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED)
      async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ accessToken: string }> {
            const tokens = await this.auth.rotateSession(this.readRefreshCookie(request));

            this.setRefreshCookie(response, tokens);

            return { accessToken: tokens.accessToken };
      }

      @Public()
      @Post('logout')
      @HttpCode(HttpStatus.NO_CONTENT)
      @ApiCookieAuth(REFRESH_COOKIE_AUTH)
      @ApiOperation({ summary: 'Đăng xuất', description: 'Thu hồi refresh token và xoá cookie. Không có cookie thì vẫn trả 204.' })
      @ApiNoContentResponse({ description: 'Phiên đã kết thúc' })
      @ApiErrors()
      async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
            const token = request.cookies?.[REFRESH_COOKIE];

            if (typeof token === 'string') {
                  await this.auth.endSession(token);
            }

            response.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      }

      @Get('me')
      @ApiBearerAuth(BEARER_AUTH)
      @ApiOperation({ summary: 'Hồ sơ của phiên hiện tại' })
      @ApiEnvelope(publicUserSchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED)
      async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
            // Guard chỉ dựng danh tính từ token nên chưa có họ tên; đọc lại từ database.
            const fresh = await this.auth.findById(user.id);

            if (fresh === null) {
                  throw new UnauthorizedException('Tài khoản không còn tồn tại');
            }

            return toPublicUser(fresh);
      }

      /**
       * Gộp giỏ ẩn danh vào giỏ tài khoản ngay khi phiên hình thành.
       *
       * Không gộp thì khách bỏ công chọn hàng rồi đăng nhập và thấy giỏ trống —
       * đúng thời điểm dễ bỏ đi nhất. Cookie giỏ ẩn danh bị xoá sau khi gộp để
       * không còn hai giỏ cùng tồn tại.
       */
      private async mergeGuestCart(request: Request, response: Response, userId: bigint): Promise<void> {
            const token = request.cookies?.[CART_COOKIE];

            if (typeof token !== 'string' || token === '') {
                  return;
            }

            await this.carts.mergeAnonymousCart(token, userId);
            response.clearCookie(CART_COOKIE, { path: '/' });
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

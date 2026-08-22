import { Body, Controller, Delete, Get, HttpStatus, NotFoundException, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { cartMutationResultSchema, cartViewSchema, type CartMutationResult, type CartView } from '@shopflow/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { ApiEnvelope, ApiErrors } from '../../common/openapi/envelope-response.decorator.js';
import { BEARER_AUTH, CART_COOKIE_AUTH } from '../../common/openapi/swagger.js';
import { ApiZodBody } from '../../common/openapi/zod-request.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CartService, generateCartToken } from './cart.service.js';

const CART_COOKIE = 'cart_token';
const CART_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Trần mỗi dòng, đủ lớn cho mua sỉ nhỏ và đủ nhỏ để chặn số lượng vô nghĩa. */
const MAX_QUANTITY_PER_LINE = 99;

const EMPTY_CART: CartView = { lines: [], subtotal: '0', itemCount: 0 };

const IDENTIFIED_BY = 'Danh tính lấy từ access token nếu có, nếu không thì từ cookie `cart_token`. Cả hai đều không bắt buộc.';

const addItemSchema = z.object({
      sku: z.string().trim().min(1),
      quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

const quantitySchema = z.object({
      quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
});

type AuthedRequest = Request & { user?: AuthenticatedUser };

/**
 * Giỏ hàng phục vụ cả khách chưa đăng nhập lẫn tài khoản đã đăng nhập.
 *
 * Controller đánh dấu công khai, nhưng JwtAuthGuard vẫn dựng danh tính khi có
 * access token hợp lệ. Nhờ vậy một bộ đường dẫn duy nhất phục vụ được cả hai
 * loại khách, và giỏ của tài khoản luôn được ưu tiên hơn cookie ẩn danh.
 */
@ApiTags('Giỏ hàng')
@ApiBearerAuth(BEARER_AUTH)
@ApiCookieAuth(CART_COOKIE_AUTH)
@Public()
@Controller('cart')
export class CartController {
      constructor(private readonly carts: CartService) {}

      @Get()
      @ApiOperation({ summary: 'Xem giỏ hàng', description: `${IDENTIFIED_BY} Chưa có giỏ thì trả về giỏ rỗng chứ không tạo mới.` })
      @ApiEnvelope(cartViewSchema)
      @ApiErrors()
      async view(@Req() request: AuthedRequest): Promise<CartView> {
            const cartId = await this.findCartId(request);

            return cartId === null ? EMPTY_CART : this.carts.view(cartId);
      }

      @Post('items')
      @ApiOperation({
            summary: 'Thêm vào giỏ',
            description: `${IDENTIFIED_BY} Khách ẩn danh chưa có giỏ sẽ được cấp cookie \`cart_token\`. Số lượng vượt tồn bị chặn xuống, và \`adjustedQuantity\` cho biết số thực nhận.`,
      })
      @ApiZodBody(addItemSchema)
      @ApiEnvelope(cartMutationResultSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
      async addItem(
            @Body(new ZodValidationPipe(addItemSchema)) input: z.infer<typeof addItemSchema>,
            @Req() request: AuthedRequest,
            @Res({ passthrough: true }) response: Response,
      ): Promise<CartMutationResult> {
            const cartId = await this.openCartId(request, response);

            return this.carts.addItem(cartId, input.sku, input.quantity);
      }

      @Patch('items/:sku')
      @ApiOperation({ summary: 'Đổi số lượng một dòng', description: 'Số lượng 0 nghĩa là xoá dòng khỏi giỏ.' })
      @ApiParam({ name: 'sku', example: 'ATT-BLK-L' })
      @ApiZodBody(quantitySchema)
      @ApiEnvelope(cartMutationResultSchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
      async updateQuantity(
            @Param('sku') sku: string,
            @Body(new ZodValidationPipe(quantitySchema)) input: z.infer<typeof quantitySchema>,
            @Req() request: AuthedRequest,
      ): Promise<CartMutationResult> {
            return this.carts.updateQuantity(await this.requireCartId(request), sku, input.quantity);
      }

      @Delete('items/:sku')
      @ApiOperation({ summary: 'Xoá một dòng khỏi giỏ' })
      @ApiParam({ name: 'sku', example: 'ATT-BLK-L' })
      @ApiEnvelope(cartViewSchema)
      @ApiErrors(HttpStatus.NOT_FOUND)
      async removeItem(@Param('sku') sku: string, @Req() request: AuthedRequest): Promise<CartView> {
            return this.carts.removeItem(await this.requireCartId(request), sku);
      }

      /**
       * Tìm giỏ hiện có mà không tạo mới.
       *
       * Đường dẫn chỉ đọc hoặc chỉ sửa dòng sẵn có phải dùng hàm này: tạo giỏ khi
       * mới xem thôi sẽ sinh một hàng rỗng cho mọi lượt truy cập, kể cả bot.
       */
      private async findCartId(request: AuthedRequest): Promise<bigint | null> {
            if (request.user !== undefined) {
                  return this.carts.findId({ userId: request.user.id });
            }

            const token = this.readCartCookie(request);

            return token === null ? null : this.carts.findId({ token });
      }

      private async requireCartId(request: AuthedRequest): Promise<bigint> {
            const cartId = await this.findCartId(request);

            if (cartId === null) {
                  throw new NotFoundException('Giỏ hàng không tồn tại');
            }

            return cartId;
      }

      /**
       * Lấy giỏ để ghi, tạo mới nếu chưa có. Khách ẩn danh chưa có mã thì được cấp
       * một mã và nhận cookie httpOnly, nhờ đó đóng trình duyệt mở lại giỏ vẫn còn.
       *
       * Cookie đặt ở path gốc vì mọi đường dẫn giỏ đều cần, khác với refresh token
       * vốn chỉ đi kèm nhánh auth.
       */
      private async openCartId(request: AuthedRequest, response: Response): Promise<bigint> {
            if (request.user !== undefined) {
                  return (await this.carts.findOrCreate({ userId: request.user.id })).id;
            }

            const existing = this.readCartCookie(request);
            const token = existing ?? generateCartToken();

            if (existing === null) {
                  response.cookie(CART_COOKIE, token, {
                        httpOnly: true,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production',
                        path: '/',
                        maxAge: CART_COOKIE_MAX_AGE_MS,
                  });
            }

            return (await this.carts.findOrCreate({ token })).id;
      }

      private readCartCookie(request: AuthedRequest): string | null {
            const token: unknown = request.cookies?.[CART_COOKIE];

            return typeof token === 'string' && token !== '' ? token : null;
      }
}

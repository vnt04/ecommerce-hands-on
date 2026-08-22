import {
      Body,
      Controller,
      Delete,
      Get,
      HttpStatus,
      Param,
      ParseIntPipe,
      Patch,
      Post,
      Query,
      UploadedFile,
      UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
      adminProductDetailSchema,
      adminProductImageSchema,
      adminProductSummarySchema,
      catalogAxesSchema,
      variantChangeEntrySchema,
      type AdminProductDetail,
      type AdminProductImage,
      type AdminProductSummary,
      type CatalogAxes,
      type Meta,
      type VariantChangeEntry,
} from '@shopflow/shared';
import { z } from 'zod';

import { ApiEnvelope, ApiErrors } from '../../common/openapi/envelope-response.decorator.js';
import { BEARER_AUTH } from '../../common/openapi/swagger.js';
import { ApiZodBody, ApiZodQuery } from '../../common/openapi/zod-request.decorator.js';
import { toOpenApiSchema } from '../../common/openapi/zod-schema.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CatalogService } from './catalog.service.js';
import {
      adjustStockSchema,
      adminProductQuerySchema,
      createProductSchema,
      extendMatrixSchema,
      updateProductSchema,
      updateVariantSchema,
      uploadImageSchema,
      type AdjustStockBody,
      type AdminProductQueryInput,
      type CreateProductBody,
      type ExtendMatrixBody,
      type UpdateProductBody,
      type UpdateVariantBody,
      type UploadImageBody,
} from './dto/admin-product.schema.js';
import { ADMIN_PRODUCTS_PAGE_SIZE, ProductAdminService } from './product-admin.service.js';
import { MAX_IMAGE_BYTES, ProductImageService } from './product-image.service.js';

const SLUG_PARAM = { name: 'slug', example: 'ao-thun-tron' };
const SKU_PARAM = { name: 'sku', example: 'ATT-BLK-L' };

const stockResultSchema = z.object({ sku: z.string(), stockAfter: z.number().int() });
const removedSchema = z.object({ removed: z.literal(true) });

/** Trường của tệp ghép cùng các trường văn bản, vì multipart không mô tả được bằng Zod. */
const uploadImageBodySchema = {
      type: 'object',
      required: ['file', 'productSlug'],
      properties: {
            file: { type: 'string', format: 'binary', description: `Ảnh JPEG, PNG hoặc WebP. Tối đa ${MAX_IMAGE_BYTES} byte` },
            ...toOpenApiSchema(uploadImageSchema, 'input').properties,
      },
};

/**
 * Khu vực quản trị sản phẩm và tồn kho.
 *
 * `@Roles(ADMIN)` đặt ở cấp lớp: thêm phương thức mới thì nó vẫn được bảo vệ mà
 * không cần nhớ đánh dấu.
 */
@ApiTags('Quản trị sản phẩm')
@ApiBearerAuth(BEARER_AUTH)
@Roles('ADMIN')
@Controller('admin')
export class AdminCatalogController {
      constructor(
            private readonly products: ProductAdminService,
            private readonly images: ProductImageService,
            private readonly catalog: CatalogService,
            private readonly prisma: PrismaService,
      ) {}

      /** Danh mục, màu và size có sẵn, để màn hình tạo thiết kế dựng được ma trận. */
      @Get('catalog-axes')
      @ApiOperation({ summary: 'Trục dựng ma trận biến thể', description: 'Danh mục, màu và size có sẵn trong hệ thống.' })
      @ApiEnvelope(catalogAxesSchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
      async axes(): Promise<CatalogAxes> {
            const [categories, colors, sizes] = await Promise.all([
                  this.prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true } }),
                  this.prisma.color.findMany({ orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, hexCode: true } }),
                  this.prisma.size.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, sortOrder: true } }),
            ]);

            return {
                  categories: categories.map((item) => ({ ...item, id: item.id.toString() })),
                  colors: colors.map((item) => ({ ...item, id: item.id.toString() })),
                  sizes: sizes.map((item) => ({ ...item, id: item.id.toString() })),
            };
      }

      @Get('products')
      @ApiOperation({ summary: 'Danh sách thiết kế', description: 'Thiết kế đã lưu trữ chỉ hiện khi `includeArchived=true`.' })
      @ApiZodQuery(adminProductQuerySchema)
      @ApiEnvelope(adminProductSummarySchema, { paginated: true })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
      async list(
            @Query(new ZodValidationPipe(adminProductQuerySchema)) query: AdminProductQueryInput,
      ): Promise<{ items: AdminProductSummary[]; meta: Meta }> {
            const { items, total } = await this.products.list(query);

            return { items, meta: { page: query.page, limit: ADMIN_PRODUCTS_PAGE_SIZE, total } };
      }

      @Post('products')
      @ApiOperation({
            summary: 'Tạo thiết kế kèm ma trận biến thể',
            description: 'Sinh sẵn một biến thể cho mỗi tổ hợp màu × size, dùng chung giá và tồn mặc định.',
      })
      @ApiZodBody(createProductSchema)
      @ApiEnvelope(adminProductDetailSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.CONFLICT)
      async create(@Body(new ZodValidationPipe(createProductSchema)) input: CreateProductBody): Promise<AdminProductDetail> {
            // Dùng lại logic sinh ma trận đã có từ S03; bước này chỉ mở đường HTTP tới nó.
            await this.catalog.createProductWithMatrix(input);

            return this.products.detail(input.slug);
      }

      @Get('products/:slug')
      @ApiOperation({ summary: 'Chi tiết thiết kế', description: 'Kèm toàn bộ biến thể và ảnh, cả biến thể đang tắt.' })
      @ApiParam(SLUG_PARAM)
      @ApiEnvelope(adminProductDetailSchema)
      @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      detail(@Param('slug') slug: string): Promise<AdminProductDetail> {
            return this.products.detail(slug);
      }

      @Patch('products/:slug')
      @ApiOperation({ summary: 'Sửa thông tin thiết kế', description: 'Chỉ gửi những trường cần đổi. Gửi thân rỗng trả 400.' })
      @ApiParam(SLUG_PARAM)
      @ApiZodBody(updateProductSchema)
      @ApiEnvelope(adminProductDetailSchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      update(
            @Param('slug') slug: string,
            @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductBody,
      ): Promise<AdminProductDetail> {
            return this.products.update(slug, input);
      }

      @Post('products/:slug/variants')
      @ApiOperation({
            summary: 'Mở rộng ma trận biến thể',
            description: 'Thêm màu hoặc size vào thiết kế sẵn có. Tổ hợp đã tồn tại được bỏ qua chứ không ghi đè.',
      })
      @ApiParam(SLUG_PARAM)
      @ApiZodBody(extendMatrixSchema)
      @ApiEnvelope(adminProductDetailSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      extendMatrix(
            @Param('slug') slug: string,
            @Body(new ZodValidationPipe(extendMatrixSchema)) input: ExtendMatrixBody,
      ): Promise<AdminProductDetail> {
            return this.products.extendMatrix(slug, input.colorIds, input.sizeIds, input.defaultPrice);
      }

      @Patch('variants/:sku')
      @ApiOperation({
            summary: 'Đổi giá hoặc bật tắt một biến thể',
            description: 'Trả về lịch sử thay đổi của biến thể sau khi ghi. Đổi giá không chạm tới đơn đã đặt (ràng buộc R4).',
      })
      @ApiParam(SKU_PARAM)
      @ApiZodBody(updateVariantSchema)
      @ApiEnvelope(variantChangeEntrySchema, { isArray: true })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      async updateVariant(
            @Param('sku') sku: string,
            @Body(new ZodValidationPipe(updateVariantSchema)) input: UpdateVariantBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<VariantChangeEntry[]> {
            await this.products.updateVariant(sku, input, user.id);

            return this.products.historyOf(sku);
      }

      @Post('variants/:sku/stock')
      @ApiOperation({
            summary: 'Điều chỉnh tồn kho',
            description: 'Nhập lượng cộng thêm chứ không nhập số cuối. Số âm là điều chỉnh giảm, số 0 bị từ chối.',
      })
      @ApiParam(SKU_PARAM)
      @ApiZodBody(adjustStockSchema)
      @ApiEnvelope(stockResultSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
      async adjustStock(
            @Param('sku') sku: string,
            @Body(new ZodValidationPipe(adjustStockSchema)) input: AdjustStockBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<{ sku: string; stockAfter: number }> {
            const { stockAfter } = await this.products.adjustStock(sku, input.delta, user.id, input.reason);

            return { sku, stockAfter };
      }

      @Get('variants/:sku/history')
      @ApiOperation({ summary: 'Lịch sử giá và tồn kho của một biến thể' })
      @ApiParam(SKU_PARAM)
      @ApiEnvelope(variantChangeEntrySchema, { isArray: true })
      @ApiErrors(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      history(@Param('sku') sku: string): Promise<VariantChangeEntry[]> {
            return this.products.historyOf(sku);
      }

      /**
       * Tải một ảnh lên.
       *
       * Trần dung lượng đặt ở cả tầng nhận tệp lẫn tầng nghiệp vụ: tầng nhận tệp
       * chặn sớm để không đọc hết vào bộ nhớ, tầng nghiệp vụ chặn lần nữa vì nó
       * không được phép tin vào cấu hình của tầng trên.
       */
      @Post('images')
      @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
      @ApiOperation({
            summary: 'Tải ảnh sản phẩm',
            description:
                  'Định dạng nhận diện theo nội dung tệp chứ không theo phần mở rộng. Bỏ trống `colorCode` thì ảnh dùng chung cho cả thiết kế.',
      })
      @ApiConsumes('multipart/form-data')
      @ApiBody({ schema: uploadImageBodySchema })
      @ApiEnvelope(adminProductImageSchema, { status: HttpStatus.CREATED })
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      upload(
            @UploadedFile() file: Express.Multer.File | undefined,
            @Body(new ZodValidationPipe(uploadImageSchema)) input: UploadImageBody,
      ): Promise<AdminProductImage> {
            return this.images.upload({ ...input, content: file?.buffer ?? Buffer.alloc(0) });
      }

      @Delete('images/:id')
      @ApiOperation({ summary: 'Xoá một ảnh sản phẩm' })
      @ApiParam({ name: 'id', schema: { type: 'integer' }, example: 1 })
      @ApiEnvelope(removedSchema)
      @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
      async removeImage(@Param('id', ParseIntPipe) id: number): Promise<{ removed: true }> {
            await this.images.remove(BigInt(id));

            return { removed: true };
      }
}

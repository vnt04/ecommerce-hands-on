import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AdminProductDetail, AdminProductImage, AdminProductSummary, CatalogAxes, Meta, VariantChangeEntry } from '@shopflow/shared';

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

/**
 * Khu vực quản trị sản phẩm và tồn kho.
 *
 * `@Roles(ADMIN)` đặt ở cấp lớp: thêm phương thức mới thì nó vẫn được bảo vệ mà
 * không cần nhớ đánh dấu.
 */
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
      async list(
            @Query(new ZodValidationPipe(adminProductQuerySchema)) query: AdminProductQueryInput,
      ): Promise<{ items: AdminProductSummary[]; meta: Meta }> {
            const { items, total } = await this.products.list(query);

            return { items, meta: { page: query.page, limit: ADMIN_PRODUCTS_PAGE_SIZE, total } };
      }

      @Post('products')
      async create(@Body(new ZodValidationPipe(createProductSchema)) input: CreateProductBody): Promise<AdminProductDetail> {
            // Dùng lại logic sinh ma trận đã có từ S03; bước này chỉ mở đường HTTP tới nó.
            await this.catalog.createProductWithMatrix(input);

            return this.products.detail(input.slug);
      }

      @Get('products/:slug')
      detail(@Param('slug') slug: string): Promise<AdminProductDetail> {
            return this.products.detail(slug);
      }

      @Patch('products/:slug')
      update(
            @Param('slug') slug: string,
            @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductBody,
      ): Promise<AdminProductDetail> {
            return this.products.update(slug, input);
      }

      @Post('products/:slug/variants')
      extendMatrix(
            @Param('slug') slug: string,
            @Body(new ZodValidationPipe(extendMatrixSchema)) input: ExtendMatrixBody,
      ): Promise<AdminProductDetail> {
            return this.products.extendMatrix(slug, input.colorIds, input.sizeIds, input.defaultPrice);
      }

      @Patch('variants/:sku')
      async updateVariant(
            @Param('sku') sku: string,
            @Body(new ZodValidationPipe(updateVariantSchema)) input: UpdateVariantBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<VariantChangeEntry[]> {
            await this.products.updateVariant(sku, input, user.id);

            return this.products.historyOf(sku);
      }

      @Post('variants/:sku/stock')
      async adjustStock(
            @Param('sku') sku: string,
            @Body(new ZodValidationPipe(adjustStockSchema)) input: AdjustStockBody,
            @CurrentUser() user: AuthenticatedUser,
      ): Promise<{ sku: string; stockAfter: number }> {
            const { stockAfter } = await this.products.adjustStock(sku, input.delta, user.id, input.reason);

            return { sku, stockAfter };
      }

      @Get('variants/:sku/history')
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
      upload(
            @UploadedFile() file: Express.Multer.File | undefined,
            @Body(new ZodValidationPipe(uploadImageSchema)) input: UploadImageBody,
      ): Promise<AdminProductImage> {
            return this.images.upload({ ...input, content: file?.buffer ?? Buffer.alloc(0) });
      }

      @Delete('images/:id')
      async removeImage(@Param('id', ParseIntPipe) id: number): Promise<{ removed: true }> {
            await this.images.remove(BigInt(id));

            return { removed: true };
      }
}

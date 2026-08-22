import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
      catalogFilterOptionsSchema,
      productCardSchema,
      productDetailSchema,
      type CatalogFilterOptions,
      type ProductDetail,
} from '@shopflow/shared';

import { ApiEnvelope, ApiErrors } from '../../common/openapi/envelope-response.decorator.js';
import { ApiZodQuery } from '../../common/openapi/zod-request.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../auth/auth.decorators.js';
import { CatalogQueryService, type ProductListResult } from './catalog-query.service.js';
import { productListQuerySchema, type ProductListQuery } from './dto/product-query.schema.js';

/** Catalog là dữ liệu công khai: khách chưa đăng nhập vẫn duyệt được. */
@ApiTags('Catalog')
@Public()
@Controller()
export class CatalogController {
      constructor(private readonly catalogQuery: CatalogQueryService) {}

      /**
       * Tập giá trị lọc được. Đặt ở đường dẫn riêng chứ không phải /products/filters:
       * đường dẫn đó sẽ tranh chấp với /products/:slug, và một sản phẩm có slug là
       * "filters" sẽ không bao giờ mở được.
       */
      @Get('catalog/filters')
      @ApiOperation({ summary: 'Tập giá trị lọc được', description: 'Danh sách màu và size đang có, để trang danh sách dựng bộ lọc.' })
      @ApiEnvelope(catalogFilterOptionsSchema)
      @ApiErrors()
      async filterOptions(): Promise<CatalogFilterOptions> {
            return this.catalogQuery.listFilterOptions();
      }

      @Get('products')
      @ApiOperation({ summary: 'Danh sách sản phẩm', description: 'Lọc theo màu, size, khoảng giá và từ khoá. Có phân trang.' })
      @ApiZodQuery(productListQuerySchema)
      @ApiEnvelope(productCardSchema, { paginated: true })
      @ApiErrors(HttpStatus.BAD_REQUEST)
      async list(@Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery): Promise<ProductListResult> {
            return this.catalogQuery.listProducts(query);
      }

      @Get('products/:slug')
      @ApiOperation({ summary: 'Chi tiết sản phẩm', description: 'Kèm toàn bộ biến thể màu × size, cả biến thể đang hết hàng.' })
      @ApiParam({ name: 'slug', example: 'ao-thun-tron' })
      @ApiEnvelope(productDetailSchema)
      @ApiErrors(HttpStatus.NOT_FOUND)
      async detail(@Param('slug') slug: string): Promise<ProductDetail> {
            return this.catalogQuery.getProductBySlug(slug);
      }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CatalogFilterOptions, ProductDetail } from '@shopflow/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CatalogQueryService, type ProductListResult } from './catalog-query.service.js';
import { productListQuerySchema, type ProductListQuery } from './dto/product-query.schema.js';

@Controller()
export class CatalogController {
      constructor(private readonly catalogQuery: CatalogQueryService) {}

      /**
       * Tập giá trị lọc được. Đặt ở đường dẫn riêng chứ không phải /products/filters:
       * đường dẫn đó sẽ tranh chấp với /products/:slug, và một sản phẩm có slug là
       * "filters" sẽ không bao giờ mở được.
       */
      @Get('catalog/filters')
      async filterOptions(): Promise<CatalogFilterOptions> {
            return this.catalogQuery.listFilterOptions();
      }

      @Get('products')
      async list(@Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery): Promise<ProductListResult> {
            return this.catalogQuery.listProducts(query);
      }

      @Get('products/:slug')
      async detail(@Param('slug') slug: string): Promise<ProductDetail> {
            return this.catalogQuery.getProductBySlug(slug);
      }
}

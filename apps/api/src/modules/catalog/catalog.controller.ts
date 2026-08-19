import { Controller, Get, Param, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CatalogQueryService, type ProductDetail, type ProductListResult } from './catalog-query.service.js';
import { productListQuerySchema, type ProductListQuery } from './dto/product-query.schema.js';

@Controller('products')
export class CatalogController {
      constructor(private readonly catalogQuery: CatalogQueryService) {}

      @Get()
      async list(@Query(new ZodValidationPipe(productListQuerySchema)) query: ProductListQuery): Promise<ProductListResult> {
            return this.catalogQuery.listProducts(query);
      }

      @Get(':slug')
      async detail(@Param('slug') slug: string): Promise<ProductDetail> {
            return this.catalogQuery.getProductBySlug(slug);
      }
}

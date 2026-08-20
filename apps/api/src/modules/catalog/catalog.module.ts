import { Module } from '@nestjs/common';

import { CatalogQueryService } from './catalog-query.service.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductAdminService } from './product-admin.service.js';
import { ProductImageService } from './product-image.service.js';

@Module({
      controllers: [CatalogController, AdminCatalogController],
      providers: [CatalogService, CatalogQueryService, ProductAdminService, ProductImageService],
      exports: [CatalogService, CatalogQueryService, ProductAdminService, ProductImageService],
})
export class CatalogModule {}

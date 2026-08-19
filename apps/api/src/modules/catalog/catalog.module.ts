import { Module } from '@nestjs/common';

import { CatalogQueryService } from './catalog-query.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
      controllers: [CatalogController],
      providers: [CatalogService, CatalogQueryService],
      exports: [CatalogService, CatalogQueryService],
})
export class CatalogModule {}

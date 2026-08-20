import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service.js';

/**
 * Đánh dấu global vì kho ảnh là hạ tầng, giống Prisma và Redis: nhiều module cần
 * tới nó và việc khai báo import ở từng nơi chỉ là tiếng ồn.
 */
@Global()
@Module({
      providers: [StorageService],
      exports: [StorageService],
})
export class StorageModule {}

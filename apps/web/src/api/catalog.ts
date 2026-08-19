import type { CatalogFilterOptions, ProductCard, ProductDetail } from '@shopflow/shared';

import { apiGet, type ApiResult } from './client.js';

export type ProductFilters = {
      color?: string;
      size?: string;
      inStock?: boolean;
      page?: number;
};

export function fetchProducts(filters: ProductFilters): Promise<ApiResult<ProductCard[]>> {
      return apiGet<ProductCard[]>('/products', {
            color: filters.color,
            size: filters.size,
            // Chỉ gửi khi bật: gửi inStock=false nghĩa là "không lọc", nhưng viết ra
            // trên URL lại trông như "chỉ lấy hàng đã hết".
            inStock: filters.inStock === true ? 'true' : undefined,
            page: filters.page,
      });
}

export function fetchProduct(slug: string): Promise<ApiResult<ProductDetail>> {
      return apiGet<ProductDetail>('/products/' + slug);
}

export function fetchFilterOptions(): Promise<ApiResult<CatalogFilterOptions>> {
      return apiGet<CatalogFilterOptions>('/catalog/filters');
}

import type {
      AdminProductDetail,
      AdminProductImage,
      AdminProductSummary,
      CatalogAxes,
      Meta,
      ProductStatus,
      VariantChangeEntry,
} from '@shopflow/shared';

import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from './client.js';

export type AdminProductFilters = {
      status?: ProductStatus;
      includeArchived?: boolean;
      search?: string;
      page?: number;
};

export function fetchCatalogAxes(): Promise<CatalogAxes> {
      return apiGet<CatalogAxes>('/admin/catalog-axes').then((result) => result.data);
}

export function fetchAdminProducts(filters: AdminProductFilters): Promise<{ items: AdminProductSummary[]; meta?: Meta }> {
      return apiGet<AdminProductSummary[]>('/admin/products', {
            status: filters.status,
            includeArchived: filters.includeArchived === true ? 'true' : undefined,
            search: filters.search,
            page: filters.page,
      }).then((result) => ({ items: result.data, meta: result.meta }));
}

export type CreateProductInput = {
      categoryId: string;
      designCode: string;
      slug: string;
      name: string;
      description?: string;
      material?: string;
      colorIds: string[];
      sizeIds: string[];
      defaultPrice: string;
      defaultStockQuantity: number;
};

export function createProduct(input: CreateProductInput): Promise<AdminProductDetail> {
      return apiPost<AdminProductDetail>('/admin/products', input).then((result) => result.data);
}

export function fetchAdminProduct(slug: string): Promise<AdminProductDetail> {
      return apiGet<AdminProductDetail>('/admin/products/' + encodeURIComponent(slug)).then((result) => result.data);
}

export type UpdateProductInput = {
      name?: string;
      description?: string | null;
      material?: string | null;
      status?: ProductStatus;
      archived?: boolean;
};

export function updateProduct(slug: string, input: UpdateProductInput): Promise<AdminProductDetail> {
      return apiPatch<AdminProductDetail>('/admin/products/' + encodeURIComponent(slug), input).then((result) => result.data);
}

export function extendMatrix(
      slug: string,
      input: { colorIds?: string[]; sizeIds?: string[]; defaultPrice: string },
): Promise<AdminProductDetail> {
      return apiPost<AdminProductDetail>('/admin/products/' + encodeURIComponent(slug) + '/variants', input).then((result) => result.data);
}

export function updateVariant(sku: string, input: { price?: string; isActive?: boolean; reason?: string }): Promise<VariantChangeEntry[]> {
      return apiPatch<VariantChangeEntry[]>('/admin/variants/' + encodeURIComponent(sku), input).then((result) => result.data);
}

export function adjustStock(sku: string, delta: number, reason?: string): Promise<{ sku: string; stockAfter: number }> {
      return apiPost<{ sku: string; stockAfter: number }>('/admin/variants/' + encodeURIComponent(sku) + '/stock', {
            delta,
            reason,
      }).then((result) => result.data);
}

export function fetchVariantHistory(sku: string): Promise<VariantChangeEntry[]> {
      return apiGet<VariantChangeEntry[]>('/admin/variants/' + encodeURIComponent(sku) + '/history').then((result) => result.data);
}

export function uploadImage(input: { file: File; productSlug: string; colorCode?: string; altText?: string }): Promise<AdminProductImage> {
      const form = new FormData();
      form.append('file', input.file);
      form.append('productSlug', input.productSlug);

      if (input.colorCode !== undefined) {
            form.append('colorCode', input.colorCode);
      }

      if (input.altText !== undefined && input.altText !== '') {
            form.append('altText', input.altText);
      }

      return apiUpload<AdminProductImage>('/admin/images', form).then((result) => result.data);
}

export function removeImage(id: string): Promise<void> {
      return apiDelete<{ removed: true }>('/admin/images/' + encodeURIComponent(id)).then(() => undefined);
}

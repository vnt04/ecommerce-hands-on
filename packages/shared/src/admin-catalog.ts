/**
 * Hợp đồng dữ liệu của API quản trị sản phẩm.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003.
 */

export type ProductStatus = 'DRAFT' | 'PUBLISHED';

/** Hàng trong danh sách thiết kế: đủ để biết cái nào cần xử lý mà không phải mở ra. */
export type AdminProductSummary = {
      slug: string;
      designCode: string;
      name: string;
      status: ProductStatus;
      isArchived: boolean;
      variantCount: number;
      activeVariantCount: number;
      /** Tổng tồn của cả thiết kế, để nhìn danh sách là biết cái nào sắp hết. */
      totalStock: number;
};

export type AdminVariant = {
      sku: string;
      colorCode: string;
      colorName: string;
      colorHex: string;
      sizeName: string;
      price: string;
      stockQuantity: number;
      isActive: boolean;
};

export type AdminProductImage = {
      id: string;
      url: string;
      altText: string | null;
      /** Ảnh gắn với một màu cụ thể, hoặc rỗng nếu dùng chung cho cả thiết kế. */
      colorCode: string | null;
};

export type AdminProductDetail = {
      slug: string;
      designCode: string;
      name: string;
      description: string | null;
      material: string | null;
      careGuide: string | null;
      printMethod: string | null;
      status: ProductStatus;
      isArchived: boolean;
      categoryName: string;
      variants: AdminVariant[];
      images: AdminProductImage[];
};

/** Một dòng lịch sử của biến thể: đúng một thay đổi, hoặc giá, hoặc tồn kho. */
export type VariantChangeEntry = {
      at: string;
      /** Tên người thực hiện. Rỗng nghĩa là do hệ thống. */
      changedBy: string | null;
      reason: string | null;
} & ({ kind: 'PRICE'; from: string; to: string } | { kind: 'STOCK'; delta: number; stockAfter: number });

/** Trục dùng để dựng ma trận: danh sách màu và size có sẵn trong hệ thống. */
export type CatalogAxes = {
      categories: Array<{ id: string; slug: string; name: string }>;
      colors: Array<{ id: string; code: string; name: string; hexCode: string }>;
      sizes: Array<{ id: string; name: string; sortOrder: number }>;
};

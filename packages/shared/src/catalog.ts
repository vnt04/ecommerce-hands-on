/**
 * Hợp đồng dữ liệu của API catalog công khai.
 *
 * Định nghĩa một lần ở đây rồi cả api lẫn web cùng dùng: đổi hình dạng dữ liệu mà
 * quên sửa một phía thì typecheck đỏ ngay, thay vì để lỗi lộ ra lúc chạy.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003. Chuyển sang
 * bigint bằng `vndFromJson` hoặc định dạng thẳng bằng `formatVndFromJson`.
 */

export type ColorSummary = {
      code: string;
      name: string;
      hexCode: string;
};

export type SizeSummary = {
      name: string;
      sortOrder: number;
};

export type ProductImageSummary = {
      url: string;
      altText: string | null;
};

export type ProductCard = {
      slug: string;
      name: string;
      /** Chuỗi chữ số, đơn vị đồng. */
      minPrice: string;
      colors: ColorSummary[];
      inStock: boolean;
};

export type ProductVariantSummary = {
      sku: string;
      colorCode: string;
      sizeName: string;
      /** Chuỗi chữ số, đơn vị đồng. */
      price: string;
      /**
       * Biến thể hết hàng vẫn nằm trong danh sách. Giao diện cần biết size nào tồn
       * tại mà không mua được, để hiển thị vô hiệu hoá thay vì ẩn đi (ràng buộc R9).
       */
      inStock: boolean;
};

export type ProductDetail = {
      slug: string;
      name: string;
      description: string | null;
      material: string | null;
      careGuide: string | null;
      printMethod: string | null;
      colors: Array<ColorSummary & { images: ProductImageSummary[] }>;
      sizes: SizeSummary[];
      variants: ProductVariantSummary[];
      sizeChart: { name: string; measurements: unknown } | null;
};

/** Tập giá trị có thể lọc. Trang danh sách cần biết trước để dựng bộ lọc. */
export type CatalogFilterOptions = {
      colors: ColorSummary[];
      sizes: SizeSummary[];
};

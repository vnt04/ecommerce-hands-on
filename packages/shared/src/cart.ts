/**
 * Hợp đồng dữ liệu của API giỏ hàng.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003.
 */

export type CartLine = {
      sku: string;
      productSlug: string;
      productName: string;
      colorName: string;
      sizeName: string;
      quantity: number;
      /** Giá hiện tại, chuỗi chữ số đơn vị đồng. */
      unitPrice: string;
      lineTotal: string;
      /** Số lượng tối đa còn mua được ngay lúc này. */
      availableQuantity: number;
      isOutOfStock: boolean;
      /** Giá đã đổi kể từ lúc thêm vào giỏ. */
      hasPriceChanged: boolean;
};

export type CartView = {
      lines: CartLine[];
      subtotal: string;
      itemCount: number;
};

/** Kết quả một thao tác ghi: giỏ sau thay đổi, kèm số lượng thực nhận nếu bị chặn trần. */
export type CartMutationResult = {
      cart: CartView;
      /** Khác undefined nghĩa là số lượng đã bị chặn xuống theo tồn hiện có. */
      adjustedQuantity?: number;
};

/**
 * Hợp đồng dữ liệu của API đơn hàng.
 *
 * Mọi trường tiền là **chuỗi chữ số**, đơn vị đồng — xem ADR-003. Mọi thời điểm là
 * chuỗi ISO 8601 kèm múi giờ.
 */

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

export type PaymentMethod = 'COD' | 'GATEWAY';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

/**
 * Thông tin giao hàng. Chép vào đơn tại thời điểm đặt và không tham chiếu tới đâu:
 * sửa hồ sơ tài khoản không được phép chạm vào đơn đã đặt.
 */
export type ShippingInfo = {
      recipientName: string;
      recipientPhone: string;
      addressLine: string;
      ward: string;
      district: string;
      province: string;
      note?: string;
};

/** Một dòng đơn. Tên sản phẩm và màu là bản chép, không đọc từ catalog. */
export type OrderLine = {
      sku: string;
      productName: string;
      productSlug: string;
      colorName: string;
      sizeName: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
};

/** Đủ để dựng một hàng trong danh sách đơn, không cần tải từng dòng. */
export type OrderSummary = {
      orderNumber: string;
      status: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      placedAt: string;
      itemCount: number;
      total: string;
};

export type OrderDetail = OrderSummary & {
      lines: OrderLine[];
      shipping: ShippingInfo;
      subtotal: string;
      shippingFee: string;
};

/** Mã lỗi riêng của luồng đặt hàng, đi kèm `CONFLICT` để giao diện chỉ đúng dòng hỏng. */
export type OrderConflictReason = 'CART_EMPTY' | 'OUT_OF_STOCK' | 'NOT_SELLABLE' | 'IN_PROGRESS';

/** Chi tiết đi kèm lỗi `CONFLICT`, cho biết dòng nào chặn và còn lại bao nhiêu. */
export type OrderConflictDetail = {
      reason: OrderConflictReason;
      sku?: string;
      availableQuantity?: number;
};

/** Một dòng lịch sử: đúng một thay đổi, hoặc trạng thái đơn, hoặc trạng thái thanh toán. */
export type OrderHistoryEntry = {
      at: string;
      /** Tên người thực hiện. Rỗng nghĩa là do hệ thống. */
      changedBy: string | null;
      note: string | null;
} & ({ kind: 'STATUS'; from: OrderStatus | null; to: OrderStatus } | { kind: 'PAYMENT'; from: PaymentStatus | null; to: PaymentStatus });

export type OrderDetailWithHistory = OrderDetail & {
      history: OrderHistoryEntry[];
      /** Bước chuyển hợp lệ từ trạng thái hiện tại, đối với người đang xem. */
      allowedTransitions: OrderStatus[];
};

/** Hàng trong danh sách đơn của quản trị viên: đủ để xử lý mà không phải mở từng đơn. */
export type AdminOrderSummary = OrderSummary & {
      recipientName: string;
      recipientPhone: string;
      province: string;
};

export type AdminOrderFilters = {
      status?: OrderStatus;
      /** Ngày đặt, dạng `YYYY-MM-DD` theo giờ Việt Nam. */
      from?: string;
      to?: string;
      /** Mã đơn hoặc số điện thoại người nhận. */
      search?: string;
      page?: number;
};

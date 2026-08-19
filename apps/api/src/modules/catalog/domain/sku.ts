import { InvalidDesignCodeError } from './catalog.errors.js';

/**
 * SKU sinh từ mã thiết kế chứ không từ tên sản phẩm (ADR-006).
 *
 * Lý do: SKU không được đổi sau khi đã xuất hiện trong đơn hàng (ràng buộc R8).
 * Tên sản phẩm là thứ admin sửa thường xuyên, mã thiết kế thì không.
 */
const SKU_SEPARATOR = '-';

/** Chỉ chữ in hoa, chữ số và dấu gạch nối ở giữa. Không dấu, không khoảng trắng. */
const DESIGN_CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export function isValidDesignCode(designCode: string): boolean {
      return DESIGN_CODE_PATTERN.test(designCode);
}

/**
 * Ghép SKU từ ba thành phần: TEE-SUNSET + BLK + L cho TEE-SUNSET-BLK-L.
 *
 * Hàm này thuần và tất định: cùng đầu vào luôn cho cùng kết quả, không đọc đồng hồ
 * và không đọc database. Nhờ vậy kiểm chứng được mà không cần dựng gì.
 */
export function generateSku(input: { designCode: string; colorCode: string; sizeName: string }): string {
      const { designCode, colorCode, sizeName } = input;

      if (!isValidDesignCode(designCode)) {
            throw new InvalidDesignCodeError(designCode);
      }

      return [designCode, colorCode, sizeName].join(SKU_SEPARATOR).toUpperCase();
}

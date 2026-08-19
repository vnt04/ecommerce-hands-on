import { z } from 'zod';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;

const amountFromQuery = z
      .string()
      .regex(/^\d+$/, 'Số tiền phải là chuỗi chữ số nguyên, đơn vị đồng')
      .transform((value) => BigInt(value));

/**
 * Tham số truy vấn của endpoint danh sách sản phẩm.
 *
 * limit có trần cứng: không có trần thì một request `limit=100000` kéo cả bảng
 * lên bộ nhớ, và đó là cách rẻ nhất để làm nghẽn máy chủ.
 */
export const productListQuerySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),

      /// Mã màu, ví dụ BLK. Lọc ở mức biến thể chứ không ở mức sản phẩm.
      color: z.string().trim().toUpperCase().min(1).optional(),

      /// Tên size, ví dụ L. "Còn size L" nghĩa là tồn tại biến thể size L đang bật.
      size: z.string().trim().toUpperCase().min(1).optional(),

      minPrice: amountFromQuery.optional(),
      maxPrice: amountFromQuery.optional(),

      inStock: z
            .enum(['true', 'false'])
            .transform((value) => value === 'true')
            .optional(),

      /// Từ khoá tìm kiếm. So khớp sau khi bỏ dấu cả hai phía.
      q: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

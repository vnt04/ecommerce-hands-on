import { z } from 'zod';

/**
 * Số điện thoại di động Việt Nam: `0` hoặc `+84`, rồi đầu số 3, 5, 7, 8, 9 và tám chữ số.
 *
 * Kiểm ở đây vì số sai nghĩa là đơn không giao được, và phát hiện lúc giao thì đã
 * muộn. Không kiểm số cố định: hàng gửi qua đơn vị vận chuyển, cần số gọi được ngay.
 */
const VIETNAM_MOBILE = /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/;

const MAX_NAME_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 255;
const MAX_NOTE_LENGTH = 500;

export const placeOrderSchema = z.object({
      recipientName: z.string().trim().min(2, 'Tên người nhận quá ngắn').max(MAX_NAME_LENGTH),
      recipientPhone: z
            .string()
            .trim()
            // Bỏ khoảng trắng và dấu gạch trước khi kiểm: khách hay chép số từ danh bạ.
            .transform((value) => value.replace(/[\s.-]/g, ''))
            .refine((value) => VIETNAM_MOBILE.test(value), 'Số điện thoại không hợp lệ'),
      addressLine: z.string().trim().min(5, 'Địa chỉ quá ngắn').max(MAX_ADDRESS_LENGTH),
      ward: z.string().trim().min(1, 'Chưa chọn phường xã').max(MAX_NAME_LENGTH),
      district: z.string().trim().min(1, 'Chưa chọn quận huyện').max(MAX_NAME_LENGTH),
      province: z.string().trim().min(1, 'Chưa chọn tỉnh thành').max(MAX_NAME_LENGTH),
      note: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
});

export type PlaceOrderBody = z.infer<typeof placeOrderSchema>;

/** Độ dài tối thiểu của khoá chống trùng. UUID v4 dài 36 ký tự. */
const MIN_IDEMPOTENCY_KEY_LENGTH = 16;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export const idempotencyKeySchema = z
      .string()
      .trim()
      .min(MIN_IDEMPOTENCY_KEY_LENGTH, 'Thiếu hoặc sai khoá chống trùng')
      .max(MAX_IDEMPOTENCY_KEY_LENGTH);

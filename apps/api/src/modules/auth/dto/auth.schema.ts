import { z } from 'zod';

import { MAX_PASSWORD_BYTES } from '../domain/password.service.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_EMAIL_LENGTH = 254;
const MAX_FULL_NAME_LENGTH = 100;

/** Đủ để loại giá trị rõ ràng sai. Xác minh thật là gửi thư tới địa chỉ đó. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).regex(EMAIL_PATTERN, 'Email không hợp lệ');

/**
 * bcrypt chỉ đọc 72 byte đầu và bỏ lặng phần còn lại, nên phải chặn theo **byte**
 * chứ không theo ký tự: một mật khẩu 30 ký tự tiếng Việt có dấu đã vượt 72 byte.
 *
 * Không chặn thì hai mật khẩu dài khác nhau nhưng trùng 72 byte đầu sẽ đăng nhập
 * được cho nhau, và không có gì báo động.
 */
const password = z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải dài ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, `Mật khẩu quá dài, tối đa ${MAX_PASSWORD_BYTES} byte`);

export const registerSchema = z.object({
      email,
      password,
      fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên').max(MAX_FULL_NAME_LENGTH),
});

export const loginSchema = z.object({
      email,
      // Không áp ràng buộc độ dài khi đăng nhập: mật khẩu cũ có thể không thoả
      // quy tắc hiện tại, và từ chối sớm cũng là một đường dò.
      password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

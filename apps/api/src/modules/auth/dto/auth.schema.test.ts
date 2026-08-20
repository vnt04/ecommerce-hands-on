import { describe, expect, test } from 'vitest';

import { loginSchema, registerSchema } from './auth.schema.js';

const VALID = { email: 'khach@example.com', password: 'matkhau12345', fullName: 'Nguyễn Văn A' };

describe('registerSchema', () => {
      test('chấp nhận dữ liệu hợp lệ', () => {
            expect(registerSchema.parse(VALID).email).toBe('khach@example.com');
      });

      test('chuẩn hoá email về chữ thường và bỏ khoảng trắng thừa', () => {
            // Không chuẩn hoá thì cùng một người đăng ký được hai tài khoản.
            expect(registerSchema.parse({ ...VALID, email: '  Khach@Example.COM ' }).email).toBe('khach@example.com');
      });

      test('từ chối mật khẩu quá ngắn', () => {
            expect(() => registerSchema.parse({ ...VALID, password: 'ngan' })).toThrow();
      });

      test('từ chối mật khẩu vượt 72 byte, tính theo byte chứ không theo ký tự', () => {
            // bcrypt chỉ đọc 72 byte đầu và bỏ lặng phần còn lại. Không chặn thì hai
            // mật khẩu khác nhau nhưng trùng 72 byte đầu đăng nhập được cho nhau.
            const thirtyVietnameseChars = 'à'.repeat(37);

            expect(Buffer.byteLength(thirtyVietnameseChars, 'utf8')).toBeGreaterThan(72);
            expect(() => registerSchema.parse({ ...VALID, password: thirtyVietnameseChars })).toThrow();
      });

      test('chấp nhận mật khẩu dài đúng bằng giới hạn', () => {
            expect(() => registerSchema.parse({ ...VALID, password: 'a'.repeat(72) })).not.toThrow();
      });

      test('từ chối email sai định dạng', () => {
            expect(() => registerSchema.parse({ ...VALID, email: 'khong-phai-email' })).toThrow();
      });

      test('từ chối họ tên rỗng', () => {
            expect(() => registerSchema.parse({ ...VALID, fullName: '   ' })).toThrow();
      });
});

describe('loginSchema', () => {
      test('không áp ràng buộc độ dài mật khẩu', () => {
            // Mật khẩu cũ có thể không thoả quy tắc hiện tại, và từ chối sớm cũng
            // là một đường dò xem tài khoản nào tồn tại.
            expect(() => loginSchema.parse({ email: 'a@b.co', password: 'x' })).not.toThrow();
      });

      test('vẫn từ chối mật khẩu rỗng', () => {
            expect(() => loginSchema.parse({ email: 'a@b.co', password: '' })).toThrow();
      });
});

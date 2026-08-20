import { describe, expect, test } from 'vitest';

import { MAX_PASSWORD_BYTES, PasswordService } from './password.service.js';

const passwords = new PasswordService();

describe('PasswordService', () => {
      test('cùng mật khẩu cho hai chuỗi băm khác nhau', async () => {
            // Muối ngẫu nhiên: hai người dùng cùng mật khẩu không lộ ra qua database.
            const [first, second] = await Promise.all([passwords.hash('matkhau12345'), passwords.hash('matkhau12345')]);

            expect(first).not.toBe(second);
      });

      test('xác minh đúng mật khẩu', async () => {
            const hash = await passwords.hash('matkhau12345');

            await expect(passwords.verify('matkhau12345', hash)).resolves.toBe(true);
      });

      test('từ chối mật khẩu sai', async () => {
            const hash = await passwords.hash('matkhau12345');

            await expect(passwords.verify('sai-mat-khau', hash)).resolves.toBe(false);
      });

      test('dùng cost 12 như đã chốt', async () => {
            expect(await passwords.hash('matkhau12345')).toMatch(/^\$2[aby]\$12\$/);
      });

      test('bcrypt bỏ qua phần vượt quá giới hạn byte', async () => {
            // Ghi lại hành vi này bằng test để không ai gỡ ràng buộc độ dài ở tầng
            // kiểm tra dữ liệu vào vì tưởng nó thừa.
            const atLimit = 'a'.repeat(MAX_PASSWORD_BYTES);
            const beyondLimit = atLimit + 'phan-nay-bi-bo-qua';
            const hash = await passwords.hash(atLimit);

            await expect(passwords.verify(beyondLimit, hash)).resolves.toBe(true);
      });

      test('so khớp giả không ném lỗi', async () => {
            await expect(passwords.verifyAgainstDummy('bat-ky')).resolves.toBeUndefined();
      });
});

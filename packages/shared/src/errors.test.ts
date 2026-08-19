import { describe, expect, test } from 'vitest';

import { DEFAULT_ERROR_MESSAGES, ERROR_CODES } from './errors.js';

describe('Catalog mã lỗi', () => {
      test('mọi mã lỗi đều có thông báo mặc định', () => {
            // Thêm mã mới mà quên thông báo thì client nhận về undefined,
            // và lỗi đó chỉ lộ ra đúng lúc người dùng gặp tình huống lỗi.
            for (const code of Object.values(ERROR_CODES)) {
                  expect(DEFAULT_ERROR_MESSAGES[code]).toBeTruthy();
            }
      });

      test('không có thông báo thừa cho mã không tồn tại', () => {
            expect(Object.keys(DEFAULT_ERROR_MESSAGES).sort()).toEqual(Object.values(ERROR_CODES).sort());
      });

      test('giá trị của mỗi mã trùng với tên hằng, để tra ngược từ log ra mã', () => {
            for (const [name, value] of Object.entries(ERROR_CODES)) {
                  expect(value).toBe(name);
            }
      });

      test('thông báo viết bằng tiếng Việt cho người dùng cuối', () => {
            // Quy ước ngôn ngữ: mã lỗi tiếng Anh cho máy, thông báo tiếng Việt cho người.
            expect(DEFAULT_ERROR_MESSAGES.NOT_FOUND).toMatch(/[àáảãạăâđêôơư]/i);
      });
});

import { describe, expect, test } from 'vitest';

import { InvalidDesignCodeError } from './catalog.errors.js';
import { generateSku, isValidDesignCode } from './sku.js';

describe('isValidDesignCode', () => {
      test.each(['TEE', 'TEE-SUNSET', 'TEE-SUNSET-2024', 'A1'])('chấp nhận %s', (code) => {
            expect(isValidDesignCode(code)).toBe(true);
      });

      test.each([
            ['tee-sunset', 'chữ thường'],
            ['TEE SUNSET', 'khoảng trắng'],
            ['TEE_SUNSET', 'gạch dưới'],
            ['ÁO-THUN', 'ký tự có dấu'],
            ['-TEE', 'gạch nối ở đầu'],
            ['TEE-', 'gạch nối ở cuối'],
            ['', 'chuỗi rỗng'],
      ])('từ chối %s vì %s', (code) => {
            expect(isValidDesignCode(code)).toBe(false);
      });
});

describe('generateSku', () => {
      test('ghép ba thành phần theo đúng quy ước', () => {
            expect(generateSku({ designCode: 'TEE-SUNSET', colorCode: 'BLK', sizeName: 'L' })).toBe('TEE-SUNSET-BLK-L');
      });

      test('giữ nguyên size có chữ số như 2XL', () => {
            expect(generateSku({ designCode: 'TEE-SUNSET', colorCode: 'NVY', sizeName: '2XL' })).toBe('TEE-SUNSET-NVY-2XL');
      });

      test('cùng đầu vào luôn cho cùng kết quả', () => {
            const input = { designCode: 'TEE-SUNSET', colorCode: 'BLK', sizeName: 'M' };

            expect(generateSku(input)).toBe(generateSku(input));
      });

      test('chuẩn hoá về chữ in hoa', () => {
            expect(generateSku({ designCode: 'TEE-SUNSET', colorCode: 'blk', sizeName: 'l' })).toBe('TEE-SUNSET-BLK-L');
      });

      test('từ chối mã thiết kế không hợp lệ thay vì sinh SKU hỏng', () => {
            // Chặn ở đây quan trọng vì SKU không sửa được sau khi đã vào đơn hàng.
            expect(() => generateSku({ designCode: 'Áo Thun', colorCode: 'BLK', sizeName: 'L' })).toThrow(InvalidDesignCodeError);
      });
});

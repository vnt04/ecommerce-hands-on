import { describe, expect, test } from 'vitest';

import { formatVnd } from './money.js';

describe('formatVnd', () => {
      test('chèn dấu chấm phân cách mỗi ba chữ số', () => {
            expect(formatVnd(299000n)).toBe('299.000 ₫');
      });

      test('giữ nguyên số nhỏ hơn một nghìn', () => {
            expect(formatVnd(999n)).toBe('999 ₫');
      });

      test('trả về 0 khi số tiền bằng không', () => {
            expect(formatVnd(0n)).toBe('0 ₫');
      });

      test('đặt dấu trừ trước số tiền âm', () => {
            expect(formatVnd(-50000n)).toBe('-50.000 ₫');
      });

      test('định dạng đúng số vượt giới hạn an toàn của kiểu number', () => {
            // 9.007.199.254.740.993 lớn hơn Number.MAX_SAFE_INTEGER một đơn vị.
            // Nếu đổi sang number, giá trị này bị làm tròn sai — đây là lý do dùng bigint.
            expect(formatVnd(9007199254740993n)).toBe('9.007.199.254.740.993 ₫');
      });
});

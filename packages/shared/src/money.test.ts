import { describe, expect, test } from 'vitest';

import { formatVnd, vndFromJson, vndToJson } from './money.js';

describe('formatVnd', () => {
      test('chèn dấu chấm phân cách hàng nghìn', () => {
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

      test('xử lý số tiền vượt giới hạn an toàn của kiểu number', () => {
            expect(formatVnd(9007199254740993n)).toBe('9.007.199.254.740.993 ₫');
      });
});

describe('vndFromJson', () => {
      test('chuyển chuỗi chữ số thành bigint', () => {
            expect(vndFromJson.parse('299000')).toBe(299000n);
      });

      test('chấp nhận số tiền âm', () => {
            expect(vndFromJson.parse('-50000')).toBe(-50000n);
      });

      test('từ chối chuỗi có phần thập phân', () => {
            // Đây là chốt chặn của ràng buộc R1: tiền không bao giờ có phần lẻ.
            expect(() => vndFromJson.parse('29.9')).toThrow();
      });

      test('từ chối chuỗi không phải số', () => {
            expect(() => vndFromJson.parse('299.000 ₫')).toThrow();
      });

      test('từ chối kiểu number để không lọt qua giới hạn an toàn của number', () => {
            expect(() => vndFromJson.parse(299000)).toThrow();
      });
});

describe('vndToJson', () => {
      test('chuyển bigint thành chuỗi', () => {
            expect(vndToJson(299000n)).toBe('299000');
      });

      test('giữ nguyên giá trị vượt giới hạn an toàn của number', () => {
            expect(vndToJson(9007199254740993n)).toBe('9007199254740993');
      });
});

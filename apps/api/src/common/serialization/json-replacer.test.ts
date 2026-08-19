import { describe, expect, test } from 'vitest';

import { bigIntReplacer } from './json-replacer.js';

describe('bigIntReplacer', () => {
      test('chuyển bigint thành chuỗi', () => {
            expect(JSON.stringify({ total: 299000n }, bigIntReplacer)).toBe('{"total":"299000"}');
      });

      test('giữ nguyên các kiểu khác', () => {
            const payload = { name: 'Tee Sunset', quantity: 2, inStock: true, note: null };

            expect(JSON.stringify(payload, bigIntReplacer)).toBe(JSON.stringify(payload));
      });

      test('xử lý bigint lồng sâu trong mảng', () => {
            expect(JSON.stringify({ items: [{ price: 1n }] }, bigIntReplacer)).toBe('{"items":[{"price":"1"}]}');
      });

      test('không có hàm này thì JSON.stringify ném lỗi', () => {
            // Ghi lại lý do tồn tại của hàm, để không ai gỡ nó đi vì tưởng là thừa.
            expect(() => JSON.stringify({ total: 299000n })).toThrow(TypeError);
      });
});

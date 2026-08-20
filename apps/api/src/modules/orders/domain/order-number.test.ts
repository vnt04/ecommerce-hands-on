import { describe, expect, test } from 'vitest';

import { formatOrderNumber, vietnamDayOf } from './order-number.js';

describe('formatOrderNumber', () => {
      test('ghép đúng dạng SF-YYMMDD-NNNN của ADR-002', () => {
            expect(formatOrderNumber(new Date(Date.UTC(2026, 7, 19)), 1)).toBe('SF-260819-0001');
      });

      test('đệm số 0 cho tháng, ngày và số thứ tự', () => {
            expect(formatOrderNumber(new Date(Date.UTC(2026, 0, 5)), 42)).toBe('SF-260105-0042');
      });

      test('số thứ tự bốn chữ số vẫn giữ nguyên khi đã kín', () => {
            expect(formatOrderNumber(new Date(Date.UTC(2026, 11, 31)), 9999)).toBe('SF-261231-9999');
      });
});

describe('vietnamDayOf', () => {
      test('đơn đặt buổi tối giờ Việt Nam thuộc về ngày đó, không phải ngày UTC', () => {
            // 23:30 ngày 19/08 giờ Việt Nam là 16:30 UTC cùng ngày.
            const day = vietnamDayOf(new Date('2026-08-19T16:30:00Z'));

            expect(formatOrderNumber(day, 1)).toBe('SF-260819-0001');
      });

      test('đơn đặt sau nửa đêm giờ Việt Nam sang ngày mới dù UTC vẫn là ngày cũ', () => {
            // 00:30 ngày 20/08 giờ Việt Nam là 17:30 UTC ngày 19/08.
            const day = vietnamDayOf(new Date('2026-08-19T17:30:00Z'));

            expect(formatOrderNumber(day, 1)).toBe('SF-260820-0001');
      });

      test('bỏ phần giờ để dùng làm khoá của bảng bộ đếm', () => {
            const day = vietnamDayOf(new Date('2026-08-19T16:30:00Z'));

            expect(day.toISOString()).toBe('2026-08-19T00:00:00.000Z');
      });
});

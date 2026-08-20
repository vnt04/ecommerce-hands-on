import type { OrderStatus } from '@shopflow/shared';
import { describe, expect, test } from 'vitest';

import { allowedTransitions, canTransition, shouldRestoreStock } from './order-status.js';

const ALL_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

describe('quản trị viên chuyển trạng thái', () => {
      test.each([
            ['PENDING', 'CONFIRMED'],
            ['PENDING', 'CANCELLED'],
            ['CONFIRMED', 'SHIPPING'],
            ['CONFIRMED', 'CANCELLED'],
            ['SHIPPING', 'DELIVERED'],
      ] as Array<[OrderStatus, OrderStatus]>)('%s sang %s được phép', (from, to) => {
            expect(canTransition(from, to, true)).toBe(true);
      });

      test('đơn đã giao không quay về được trạng thái nào', () => {
            expect(allowedTransitions('DELIVERED', true)).toHaveLength(0);
      });

      test('đơn đã huỷ không đi tiếp được', () => {
            expect(allowedTransitions('CANCELLED', true)).toHaveLength(0);
      });

      test('hàng đã rời kho thì không huỷ được nữa', () => {
            // Huỷ đơn đang giao là bài toán trả hàng, không phải đổi một ô trạng thái.
            expect(canTransition('SHIPPING', 'CANCELLED', true)).toBe(false);
      });

      test('không có bước lùi nào trong máy trạng thái', () => {
            const ORDER = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED'] as const;

            for (const [index, from] of ORDER.entries()) {
                  for (const to of ORDER.slice(0, index)) {
                        expect(canTransition(from, to, true)).toBe(false);
                  }
            }
      });

      test('không trạng thái nào tự chuyển sang chính nó', () => {
            for (const status of ALL_STATUSES) {
                  expect(canTransition(status, status, true)).toBe(false);
            }
      });
});

describe('khách tự chuyển trạng thái', () => {
      test('huỷ được đơn còn chờ xác nhận', () => {
            expect(canTransition('PENDING', 'CANCELLED', false)).toBe(true);
      });

      test('không huỷ được đơn đã xác nhận', () => {
            expect(canTransition('CONFIRMED', 'CANCELLED', false)).toBe(false);
      });

      test('không tự xác nhận hay tự đánh dấu đã giao đơn của mình', () => {
            expect(canTransition('PENDING', 'CONFIRMED', false)).toBe(false);
            expect(canTransition('SHIPPING', 'DELIVERED', false)).toBe(false);
      });

      test('quyền của khách luôn là tập con của quyền quản trị viên', () => {
            for (const status of ALL_STATUSES) {
                  const admin = allowedTransitions(status, true);

                  for (const target of allowedTransitions(status, false)) {
                        expect(admin).toContain(target);
                  }
            }
      });
});

describe('shouldRestoreStock', () => {
      test('mọi trạng thái đang giữ hàng đều phải cộng trả khi huỷ', () => {
            for (const status of ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED'] as OrderStatus[]) {
                  expect(shouldRestoreStock(status)).toBe(true);
            }
      });

      test('đơn đã huỷ thì không cộng trả nữa', () => {
            // Đây là điều giữ cho việc bấm huỷ hai lần không cộng trả tồn hai lần.
            expect(shouldRestoreStock('CANCELLED')).toBe(false);
      });
});

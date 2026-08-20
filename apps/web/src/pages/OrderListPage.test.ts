import type { OrderSummary } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import OrderListPage from './OrderListPage.vue';

const fetchOrders = vi.fn();

vi.mock('../api/orders.js', () => ({
      fetchOrders: () => fetchOrders(),
      fetchOrder: vi.fn(),
      placeOrder: vi.fn(),
      newIdempotencyKey: vi.fn(),
}));

function summary(overrides: Partial<OrderSummary> = {}): OrderSummary {
      return {
            orderNumber: 'SF-260820-0001',
            status: 'PENDING',
            paymentMethod: 'COD',
            paymentStatus: 'UNPAID',
            placedAt: '2026-08-20T03:15:00.000Z',
            itemCount: 2,
            total: '598000',
            ...overrides,
      };
}

async function mountPage() {
      const wrapper = mount(OrderListPage, {
            global: {
                  plugins: [[VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
                  stubs: { RouterLink: { template: '<a><slot /></a>' } },
            },
      });

      await flushPromises();

      return wrapper;
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchOrders.mockResolvedValue([summary()]);
});

describe('OrderListPage', () => {
      test('hiện mã đơn, số sản phẩm và tổng tiền', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('SF-260820-0001');
            expect(wrapper.text()).toContain('2 sản phẩm');
            expect(wrapper.text()).toContain('598.000 ₫');
      });

      test('dịch trạng thái sang tiếng Việt', async () => {
            fetchOrders.mockResolvedValue([summary({ status: 'DELIVERED' })]);

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Đã giao');
      });

      test('giữ nguyên thứ tự máy chủ trả về', async () => {
            fetchOrders.mockResolvedValue([summary({ orderNumber: 'SF-260820-0002' }), summary({ orderNumber: 'SF-260820-0001' })]);

            const wrapper = await mountPage();

            const items = wrapper.findAll('li');
            expect(items[0]?.text()).toContain('SF-260820-0002');
            expect(items[1]?.text()).toContain('SF-260820-0001');
      });

      test('chưa có đơn nào thì báo rõ thay vì để trang trắng', async () => {
            fetchOrders.mockResolvedValue([]);

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Bạn chưa đặt đơn nào');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchOrders.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

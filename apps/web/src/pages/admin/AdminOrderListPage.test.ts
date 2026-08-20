import type { AdminOrderSummary } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AdminOrderListPage from './AdminOrderListPage.vue';

const fetchAdminOrders = vi.fn();
const push = vi.fn();
let routeQuery: Record<string, string> = {};

vi.mock('../../api/orders.js', () => ({
      fetchAdminOrders: (filters: unknown) => fetchAdminOrders(filters),
      fetchAdminOrder: vi.fn(),
      updateAdminOrder: vi.fn(),
      fetchOrder: vi.fn(),
      fetchOrders: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      newIdempotencyKey: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRoute: () => ({ query: routeQuery }),
      useRouter: () => ({ push }),
}));

function summary(overrides: Partial<AdminOrderSummary> = {}): AdminOrderSummary {
      return {
            orderNumber: 'SF-260820-0001',
            status: 'PENDING',
            paymentMethod: 'COD',
            paymentStatus: 'UNPAID',
            placedAt: '2026-08-20T03:15:00.000Z',
            itemCount: 2,
            total: '598000',
            recipientName: 'Nguyễn Văn A',
            recipientPhone: '0912345678',
            province: 'TP Hồ Chí Minh',
            ...overrides,
      };
}

async function mountPage() {
      const wrapper = mount(AdminOrderListPage, {
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
      routeQuery = {};
      fetchAdminOrders.mockResolvedValue({ items: [summary()], meta: { page: 1, limit: 20, total: 1 } });
});

describe('AdminOrderListPage', () => {
      test('hiện mã đơn, người nhận và tổng tiền', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('SF-260820-0001');
            expect(wrapper.text()).toContain('Nguyễn Văn A');
            expect(wrapper.text()).toContain('0912345678');
            expect(wrapper.text()).toContain('598.000 ₫');
            expect(wrapper.text()).toContain('Chưa thu tiền');
      });

      test('đọc bộ lọc từ URL chứ không giữ bản sao riêng', async () => {
            routeQuery = { trang_thai: 'CONFIRMED', tim: '0912345678', trang: '2' };

            await mountPage();

            expect(fetchAdminOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'CONFIRMED', search: '0912345678', page: 2 }));
      });

      test('bấm tab trạng thái thì URL đổi theo và quay về trang một', async () => {
            routeQuery = { trang: '3' };

            const wrapper = await mountPage();
            await wrapper
                  .findAll('button')
                  .find((button) => button.text() === 'Đang giao')
                  ?.trigger('click');

            expect(push).toHaveBeenCalledWith({ query: { trang: undefined, trang_thai: 'SHIPPING' } });
      });

      test('tab đang bật được đánh dấu', async () => {
            routeQuery = { trang_thai: 'PENDING' };

            const wrapper = await mountPage();
            const active = wrapper.findAll('button').find((button) => button.text() === 'Chờ xác nhận');

            expect(active?.attributes('aria-pressed')).toBe('true');
      });

      test('gõ vào ô tìm kiếm thì URL đổi theo', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[type="search"]').setValue('SF-260820-0001');
            await wrapper.find('input[type="search"]').trigger('change');

            expect(push).toHaveBeenCalledWith({ query: { tim: 'SF-260820-0001', trang: undefined } });
      });

      test('không có đơn nào khớp thì báo rõ thay vì bảng trống', async () => {
            fetchAdminOrders.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Không có đơn nào khớp bộ lọc');
      });

      test('chỉ một trang thì không hiện điều khiển phân trang', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).not.toContain('Trang sau');
      });

      test('nhiều trang thì hiện điều khiển phân trang', async () => {
            fetchAdminOrders.mockResolvedValue({ items: [summary()], meta: { page: 1, limit: 20, total: 45 } });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Trang 1 trên 3');
            expect(
                  wrapper
                        .findAll('button')
                        .find((button) => button.text() === 'Trang trước')
                        ?.attributes('disabled'),
            ).toBeDefined();
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchAdminOrders.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

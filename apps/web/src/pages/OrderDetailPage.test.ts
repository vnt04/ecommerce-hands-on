import type { OrderDetail } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import OrderDetailPage from './OrderDetailPage.vue';

const fetchOrder = vi.fn();
const routeQuery: { vua_dat?: string } = {};

vi.mock('../api/orders.js', () => ({
      fetchOrder: (orderNumber: string) => fetchOrder(orderNumber),
      fetchOrders: vi.fn(),
      placeOrder: vi.fn(),
      newIdempotencyKey: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRoute: () => ({ query: routeQuery }),
      useRouter: () => ({ push: vi.fn() }),
}));

const ORDER: OrderDetail = {
      orderNumber: 'SF-260820-0001',
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      placedAt: '2026-08-20T03:15:00.000Z',
      itemCount: 2,
      subtotal: '598000',
      shippingFee: '0',
      total: '598000',
      lines: [
            {
                  sku: 'TEE-SUNSET-BLK-L',
                  productName: 'Tee Sunset',
                  productSlug: 'tee-sunset',
                  colorName: 'Đen',
                  sizeName: 'L',
                  quantity: 2,
                  unitPrice: '299000',
                  lineTotal: '598000',
            },
      ],
      shipping: {
            recipientName: 'Nguyễn Văn A',
            recipientPhone: '0912345678',
            addressLine: '12 Nguyễn Huệ',
            ward: 'Bến Nghé',
            district: 'Quận 1',
            province: 'TP Hồ Chí Minh',
            note: 'Giao giờ hành chính',
      },
};

async function mountPage() {
      const wrapper = mount(OrderDetailPage, {
            props: { orderNumber: 'SF-260820-0001' },
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
      delete routeQuery.vua_dat;
      fetchOrder.mockResolvedValue(ORDER);
});

describe('OrderDetailPage', () => {
      test('hiện mã đơn, từng dòng và tổng tiền đã chốt', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('SF-260820-0001');
            expect(wrapper.text()).toContain('Tee Sunset');
            expect(wrapper.text()).toContain('Đen · Size L');
            expect(wrapper.text()).toContain('299.000 ₫ × 2');
            expect(wrapper.text()).toContain('598.000 ₫');
      });

      test('phí vận chuyển bằng 0 hiển thị là miễn phí chứ không phải 0 đồng', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Miễn phí');
      });

      test('hiện thông tin giao hàng đã chép vào đơn', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('0912345678');
            expect(wrapper.text()).toContain('Bến Nghé');
            expect(wrapper.text()).toContain('Giao giờ hành chính');
      });

      test('vừa đặt xong thì hiện lời xác nhận', async () => {
            routeQuery.vua_dat = '1';

            const wrapper = await mountPage();

            expect(wrapper.find('[role="status"]').text()).toContain('Đặt hàng thành công');
      });

      test('mở lại đơn cũ thì không hiện lời xác nhận', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).not.toContain('Đặt hàng thành công');
      });

      test('dịch trạng thái sang tiếng Việt', async () => {
            fetchOrder.mockResolvedValue({ ...ORDER, status: 'SHIPPING' });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Đang giao');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchOrder.mockRejectedValue(new Error('Không tìm thấy đơn hàng'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

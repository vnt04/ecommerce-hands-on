import type { OrderDetailWithHistory } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import OrderDetailPage from './OrderDetailPage.vue';

const fetchOrder = vi.fn();
const cancelOrder = vi.fn();
const routeQuery: { vua_dat?: string } = {};

vi.mock('../api/orders.js', () => ({
      fetchOrder: (orderNumber: string) => fetchOrder(orderNumber),
      cancelOrder: (orderNumber: string) => cancelOrder(orderNumber),
      fetchOrders: vi.fn(),
      fetchAdminOrders: vi.fn(),
      fetchAdminOrder: vi.fn(),
      updateAdminOrder: vi.fn(),
      placeOrder: vi.fn(),
      newIdempotencyKey: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRoute: () => ({ query: routeQuery }),
      useRouter: () => ({ push: vi.fn() }),
}));

const ORDER: OrderDetailWithHistory = {
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
      history: [],
      allowedTransitions: ['CANCELLED'],
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

function cancelButton(wrapper: Awaited<ReturnType<typeof mountPage>>) {
      return wrapper.findAll('button').find((button) => button.text().startsWith('Huỷ đơn') || button.text().startsWith('Đang huỷ'));
}

beforeEach(() => {
      vi.clearAllMocks();
      delete routeQuery.vua_dat;
      fetchOrder.mockResolvedValue(ORDER);
      cancelOrder.mockResolvedValue({ ...ORDER, status: 'CANCELLED', allowedTransitions: [] });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
      vi.restoreAllMocks();
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

      test('hiện nút huỷ khi máy chủ nói là huỷ được', async () => {
            const wrapper = await mountPage();

            expect(cancelButton(wrapper)).toBeDefined();
      });

      test('không hiện nút huỷ khi đơn đã qua bước chờ xác nhận', async () => {
            // Luật nằm ở máy chủ; giao diện chỉ đọc allowedTransitions, không tự suy.
            fetchOrder.mockResolvedValue({ ...ORDER, status: 'CONFIRMED', allowedTransitions: [] });

            const wrapper = await mountPage();

            expect(cancelButton(wrapper)).toBeUndefined();
      });

      test('huỷ đơn hỏi lại trước khi gửi', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            const wrapper = await mountPage();
            await cancelButton(wrapper)?.trigger('click');
            await flushPromises();

            expect(cancelOrder).not.toHaveBeenCalled();
      });

      test('huỷ thành công thì trạng thái đổi và nút biến mất', async () => {
            const wrapper = await mountPage();

            await cancelButton(wrapper)?.trigger('click');
            await flushPromises();

            expect(cancelOrder).toHaveBeenCalledWith('SF-260820-0001');
            expect(wrapper.text()).toContain('Đã huỷ');
            expect(cancelButton(wrapper)).toBeUndefined();
      });

      test('máy chủ từ chối huỷ thì hiện thông báo của máy chủ', async () => {
            cancelOrder.mockRejectedValue(new ApiError('CONFLICT', 'Đơn đang ở trạng thái đã xác nhận nên không tự huỷ được'));

            const wrapper = await mountPage();
            await cancelButton(wrapper)?.trigger('click');
            await flushPromises();

            expect(wrapper.find('[role="alert"]').text()).toContain('không tự huỷ được');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchOrder.mockRejectedValue(new Error('Không tìm thấy đơn hàng'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

import type { OrderDetailWithHistory } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '../../api/client.js';
import AdminOrderDetailPage from './AdminOrderDetailPage.vue';

const fetchAdminOrder = vi.fn();
const updateAdminOrder = vi.fn();

vi.mock('../../api/orders.js', () => ({
      fetchAdminOrder: (orderNumber: string) => fetchAdminOrder(orderNumber),
      updateAdminOrder: (orderNumber: string, change: unknown) => updateAdminOrder(orderNumber, change),
      fetchAdminOrders: vi.fn(),
      fetchOrder: vi.fn(),
      fetchOrders: vi.fn(),
      placeOrder: vi.fn(),
      cancelOrder: vi.fn(),
      newIdempotencyKey: vi.fn(),
}));

function orderOf(overrides: Partial<OrderDetailWithHistory> = {}): OrderDetailWithHistory {
      return {
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
            },
            history: [],
            allowedTransitions: ['CONFIRMED', 'CANCELLED'],
            ...overrides,
      };
}

async function mountPage() {
      const wrapper = mount(AdminOrderDetailPage, {
            props: { orderNumber: 'SF-260820-0001' },
            global: {
                  plugins: [[VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
                  stubs: { RouterLink: { template: '<a><slot /></a>' } },
            },
      });

      await flushPromises();

      return wrapper;
}

type Page = Awaited<ReturnType<typeof mountPage>>;

function buttonWithText(wrapper: Page, text: string) {
      return wrapper.findAll('button').find((button) => button.text() === text);
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchAdminOrder.mockResolvedValue(orderOf());
      updateAdminOrder.mockResolvedValue(orderOf({ status: 'CONFIRMED', allowedTransitions: ['SHIPPING', 'CANCELLED'] }));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
      vi.restoreAllMocks();
});

describe('AdminOrderDetailPage', () => {
      test('chỉ hiện những bước chuyển máy chủ nói là hợp lệ', async () => {
            const wrapper = await mountPage();

            expect(buttonWithText(wrapper, 'Xác nhận đơn')).toBeDefined();
            expect(buttonWithText(wrapper, 'Huỷ đơn')).toBeDefined();
            // Không được nhảy thẳng từ chờ xác nhận sang đang giao.
            expect(buttonWithText(wrapper, 'Bắt đầu giao')).toBeUndefined();
      });

      test('xác nhận đơn gọi API và giao diện đổi theo trạng thái mới', async () => {
            const wrapper = await mountPage();

            await buttonWithText(wrapper, 'Xác nhận đơn')?.trigger('click');
            await flushPromises();

            expect(updateAdminOrder).toHaveBeenCalledWith('SF-260820-0001', { status: 'CONFIRMED', note: undefined });
            expect(buttonWithText(wrapper, 'Bắt đầu giao')).toBeDefined();
      });

      test('ghi chú được gửi kèm thao tác', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[type="text"]').setValue('Đã gọi xác nhận');
            await buttonWithText(wrapper, 'Xác nhận đơn')?.trigger('click');
            await flushPromises();

            expect(updateAdminOrder).toHaveBeenCalledWith('SF-260820-0001', { status: 'CONFIRMED', note: 'Đã gọi xác nhận' });
      });

      test('huỷ đơn hỏi lại trước khi gửi', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            const wrapper = await mountPage();
            await buttonWithText(wrapper, 'Huỷ đơn')?.trigger('click');
            await flushPromises();

            expect(updateAdminOrder).not.toHaveBeenCalled();
      });

      test('đánh dấu đã thu tiền gửi trạng thái thanh toán', async () => {
            const wrapper = await mountPage();

            await buttonWithText(wrapper, 'Đánh dấu đã thu tiền')?.trigger('click');
            await flushPromises();

            expect(updateAdminOrder).toHaveBeenCalledWith('SF-260820-0001', { paymentStatus: 'PAID', note: undefined });
      });

      test('đơn đã thu tiền thì không còn nút đánh dấu', async () => {
            fetchAdminOrder.mockResolvedValue(orderOf({ paymentStatus: 'PAID' }));

            const wrapper = await mountPage();

            expect(buttonWithText(wrapper, 'Đánh dấu đã thu tiền')).toBeUndefined();
      });

      test('đơn ở trạng thái cuối thì không có thao tác nào', async () => {
            fetchAdminOrder.mockResolvedValue(orderOf({ status: 'DELIVERED', paymentStatus: 'PAID', allowedTransitions: [] }));

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Đơn đã ở trạng thái cuối');
      });

      test('hiện lịch sử kèm người thực hiện và thời điểm', async () => {
            fetchAdminOrder.mockResolvedValue(
                  orderOf({
                        history: [
                              {
                                    kind: 'STATUS',
                                    from: 'PENDING',
                                    to: 'CONFIRMED',
                                    at: '2026-08-20T04:00:00.000Z',
                                    changedBy: 'Quản trị viên',
                                    note: 'Đã gọi khách',
                              },
                              {
                                    kind: 'PAYMENT',
                                    from: 'UNPAID',
                                    to: 'PAID',
                                    at: '2026-08-20T05:00:00.000Z',
                                    changedBy: 'Quản trị viên',
                                    note: null,
                              },
                        ],
                  }),
            );

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Chờ xác nhận → Đã xác nhận');
            expect(wrapper.text()).toContain('Chưa thu tiền → Đã thu tiền');
            expect(wrapper.text()).toContain('Quản trị viên');
            expect(wrapper.text()).toContain('Đã gọi khách');
      });

      test('máy chủ từ chối thao tác thì hiện thông báo của máy chủ', async () => {
            updateAdminOrder.mockRejectedValue(new ApiError('CONFLICT', 'Đơn đang ở trạng thái đã giao nên không huỷ được nữa'));

            const wrapper = await mountPage();
            await buttonWithText(wrapper, 'Xác nhận đơn')?.trigger('click');
            await flushPromises();

            expect(wrapper.find('[role="alert"]').text()).toContain('không huỷ được nữa');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchAdminOrder.mockRejectedValue(new Error('Không tìm thấy đơn hàng'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

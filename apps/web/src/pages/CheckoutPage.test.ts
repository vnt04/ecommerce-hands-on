import type { CartLine, CartView } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '../api/client.js';
import CheckoutPage from './CheckoutPage.vue';

const fetchCart = vi.fn();
const placeOrder = vi.fn();
const push = vi.fn();

vi.mock('../api/cart.js', () => ({
      fetchCart: () => fetchCart(),
      addCartItem: vi.fn(),
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
}));

vi.mock('../api/orders.js', () => ({
      placeOrder: (shipping: unknown, key: string) => placeOrder(shipping, key),
      // Khoá cố định trong test để khẳng định được nó không đổi giữa hai lần bấm.
      newIdempotencyKey: () => 'khoa-co-dinh-cho-test',
      fetchOrders: vi.fn(),
      fetchOrder: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRouter: () => ({ push }),
      useRoute: () => ({ query: {} }),
}));

function line(overrides: Partial<CartLine> = {}): CartLine {
      return {
            sku: 'TEE-SUNSET-BLK-L',
            productSlug: 'tee-sunset',
            productName: 'Tee Sunset',
            colorName: 'Đen',
            sizeName: 'L',
            quantity: 2,
            unitPrice: '299000',
            lineTotal: '598000',
            availableQuantity: 5,
            isOutOfStock: false,
            hasPriceChanged: false,
            ...overrides,
      };
}

function cartOf(lines: CartLine[]): CartView {
      return {
            lines,
            subtotal: lines.reduce((total, item) => total + BigInt(item.lineTotal), 0n).toString(),
            itemCount: lines.reduce((total, item) => total + item.quantity, 0),
      };
}

const VALID_FORM = {
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0912345678',
      addressLine: '12 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      province: 'TP Hồ Chí Minh',
};

async function mountPage() {
      const wrapper = mount(CheckoutPage, {
            global: {
                  plugins: [[VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
                  stubs: { RouterLink: { template: '<a><slot /></a>' } },
            },
      });

      await flushPromises();

      return wrapper;
}

type Page = Awaited<ReturnType<typeof mountPage>>;

async function fillForm(wrapper: Page, overrides: Partial<typeof VALID_FORM> = {}): Promise<void> {
      const values = { ...VALID_FORM, ...overrides };
      const inputs = wrapper.findAll('input');

      // Thứ tự ô nhập trong template: tên, điện thoại, địa chỉ, phường, quận, tỉnh.
      const order = ['recipientName', 'recipientPhone', 'addressLine', 'ward', 'district', 'province'] as const;

      for (const [index, field] of order.entries()) {
            await inputs[index]?.setValue(values[field]);
      }
}

function submitButton(wrapper: Page) {
      return wrapper.findAll('button').find((button) => button.text().startsWith('Đặt hàng') || button.text().startsWith('Đang đặt'));
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchCart.mockResolvedValue(cartOf([line()]));
      placeOrder.mockResolvedValue({ orderNumber: 'SF-260820-0001' });
});

describe('CheckoutPage', () => {
      test('hiển thị tóm tắt đơn lấy từ giỏ', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Tee Sunset');
            expect(wrapper.text()).toContain('598.000 ₫');
            expect(wrapper.text()).toContain('Thanh toán khi nhận hàng');
      });

      test('gửi thông tin giao hàng kèm khoá chống trùng rồi chuyển sang trang đơn', async () => {
            const wrapper = await mountPage();

            await fillForm(wrapper);
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining(VALID_FORM), 'khoa-co-dinh-cho-test');
            expect(push).toHaveBeenCalledWith({
                  name: 'order-detail',
                  params: { orderNumber: 'SF-260820-0001' },
                  query: { vua_dat: '1' },
            });
      });

      test('bấm hai lần vẫn dùng đúng một khoá chống trùng', async () => {
            // Đây là chốt chặn R3 ở phía client. Sinh khoá mới mỗi lần bấm thì máy chủ
            // coi hai lần bấm là hai đơn khác nhau.
            placeOrder.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'Lỗi tạm thời'));

            const wrapper = await mountPage();
            await fillForm(wrapper);

            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            const [first, second] = placeOrder.mock.calls;

            expect(placeOrder).toHaveBeenCalledTimes(2);
            expect(first?.[1]).toBe('khoa-co-dinh-cho-test');
            expect(second?.[1]).toBe(first?.[1]);
      });

      test('số điện thoại sai bị chặn tại chỗ, không gọi API', async () => {
            const wrapper = await mountPage();

            await fillForm(wrapper, { recipientPhone: '12345' });
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            expect(placeOrder).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Số điện thoại di động không hợp lệ');
      });

      test('bỏ trống tỉnh thành bị chặn tại chỗ', async () => {
            const wrapper = await mountPage();

            await fillForm(wrapper, { province: '' });
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            expect(placeOrder).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Nhập tỉnh thành');
      });

      test('hết hàng giữa chừng thì nêu rõ dòng nào chặn đơn', async () => {
            placeOrder.mockRejectedValue(
                  new ApiError('CONFLICT', 'Không còn đủ hàng', {
                        reason: 'OUT_OF_STOCK',
                        sku: 'TEE-SUNSET-BLK-L',
                        availableQuantity: 1,
                  }),
            );

            const wrapper = await mountPage();
            await fillForm(wrapper);
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            expect(wrapper.text()).toContain('Kho chỉ còn 1 sản phẩm');
            expect(wrapper.text()).toContain('Dòng này chặn đơn');
      });

      test('máy chủ báo trường sai thì đánh dấu đúng ô nhập đó', async () => {
            placeOrder.mockRejectedValue(new ApiError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { fields: ['recipientPhone'] }));

            const wrapper = await mountPage();
            await fillForm(wrapper);
            await submitButton(wrapper)?.trigger('submit');
            await flushPromises();

            expect(wrapper.text()).toContain('Số điện thoại di động không hợp lệ');
            expect(wrapper.findAll('input')[1]?.attributes('aria-invalid')).toBe('true');
      });

      test('giỏ có dòng hết hàng thì không cho đặt', async () => {
            fetchCart.mockResolvedValue(cartOf([line({ isOutOfStock: true, availableQuantity: 0 })]));

            const wrapper = await mountPage();

            expect(submitButton(wrapper)?.attributes('disabled')).toBeDefined();
            expect(wrapper.text()).toContain('Xoá các dòng đã hết hàng');
      });

      test('giỏ rỗng thì báo rõ thay vì hiện form đặt hàng', async () => {
            fetchCart.mockResolvedValue(cartOf([]));

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Giỏ hàng đang trống');
            expect(wrapper.find('form').exists()).toBe(false);
      });
});

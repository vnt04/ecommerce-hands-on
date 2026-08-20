import type { CartLine, CartView } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CartPage from './CartPage.vue';

const fetchCart = vi.fn();
const updateCartItem = vi.fn();
const removeCartItem = vi.fn();

vi.mock('../api/cart.js', () => ({
      fetchCart: () => fetchCart(),
      addCartItem: vi.fn(),
      updateCartItem: (sku: string, quantity: number) => updateCartItem(sku, quantity),
      removeCartItem: (sku: string) => removeCartItem(sku),
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
      const subtotal = lines.reduce((total, item) => total + BigInt(item.lineTotal), 0n);

      return {
            lines,
            subtotal: subtotal.toString(),
            itemCount: lines.reduce((total, item) => total + item.quantity, 0),
      };
}

async function mountPage() {
      const wrapper = mount(CartPage, {
            global: {
                  plugins: [[VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
                  stubs: { RouterLink: { template: '<a><slot /></a>' } },
            },
      });

      await flushPromises();

      return wrapper;
}

/** Nút đặt hàng là một liên kết sang trang thanh toán, không phải nút gửi biểu mẫu. */
function findCheckoutLink(wrapper: Awaited<ReturnType<typeof mountPage>>) {
      return wrapper.findAll('a').find((link) => link.text() === 'Đặt hàng');
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchCart.mockResolvedValue(cartOf([line()]));
});

describe('CartPage', () => {
      test('hiển thị từng dòng kèm thành tiền và tổng tạm tính', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Tee Sunset');
            expect(wrapper.text()).toContain('Đen · Size L');
            expect(wrapper.text()).toContain('598.000 ₫');
            expect(wrapper.text()).toContain('Tạm tính (2 sản phẩm)');
      });

      test('giỏ rỗng thì báo rõ thay vì để trang trắng', async () => {
            fetchCart.mockResolvedValue(cartOf([]));

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Giỏ hàng đang trống');
      });

      test('đổi số lượng thì gọi API với số mới', async () => {
            updateCartItem.mockResolvedValue({ cart: cartOf([line({ quantity: 3, lineTotal: '897000' })]) });

            const wrapper = await mountPage();
            const select = wrapper.find('select');

            await select.setValue('3');
            await flushPromises();

            expect(updateCartItem).toHaveBeenCalledWith('TEE-SUNSET-BLK-L', 3);
            expect(wrapper.text()).toContain('897.000 ₫');
      });

      test('số lượng chọn được không vượt quá tồn còn lại', async () => {
            fetchCart.mockResolvedValue(cartOf([line({ availableQuantity: 3 })]));

            const wrapper = await mountPage();

            expect(wrapper.findAll('option')).toHaveLength(3);
      });

      test('xoá dòng thì gọi API và giỏ cập nhật ngay', async () => {
            removeCartItem.mockResolvedValue(cartOf([]));

            const wrapper = await mountPage();
            await wrapper
                  .findAll('button')
                  .find((button) => button.text() === 'Xoá')
                  ?.trigger('click');
            await flushPromises();

            expect(removeCartItem).toHaveBeenCalledWith('TEE-SUNSET-BLK-L');
            expect(wrapper.text()).toContain('Giỏ hàng đang trống');
      });

      test('dòng hết hàng bị đánh dấu và chặn đặt hàng', async () => {
            fetchCart.mockResolvedValue(cartOf([line({ isOutOfStock: true, availableQuantity: 0 })]));

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Đã hết hàng');
            expect(findCheckoutLink(wrapper)?.attributes('aria-disabled')).toBe('true');
      });

      test('giá đổi thì báo cho khách nhưng không chặn đặt hàng', async () => {
            fetchCart.mockResolvedValue(cartOf([line({ hasPriceChanged: true })]));

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Giá đã thay đổi');
            expect(findCheckoutLink(wrapper)?.attributes('aria-disabled')).toBe('false');
      });

      test('số lượng bị chặn theo tồn thì hiện thông báo điều chỉnh', async () => {
            updateCartItem.mockResolvedValue({ cart: cartOf([line({ quantity: 5 })]), adjustedQuantity: 5 });

            const wrapper = await mountPage();
            await wrapper.find('select').setValue('5');
            await flushPromises();

            expect(wrapper.text()).toContain('Kho chỉ còn 5 sản phẩm');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchCart.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

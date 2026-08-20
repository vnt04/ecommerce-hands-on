import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { ProductDetail } from '@shopflow/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProductDetailPage from './ProductDetailPage.vue';

const fetchProduct = vi.fn();
const fetchCart = vi.fn();
const addCartItem = vi.fn();

vi.mock('../api/catalog.js', () => ({
      fetchProduct: (slug: string) => fetchProduct(slug),
}));

vi.mock('../api/cart.js', () => ({
      fetchCart: () => fetchCart(),
      addCartItem: (sku: string, quantity: number) => addCartItem(sku, quantity),
      updateCartItem: vi.fn(),
      removeCartItem: vi.fn(),
}));

const EMPTY_CART = { lines: [], subtotal: '0', itemCount: 0 };

const DETAIL: ProductDetail = {
      slug: 'tee-sunset',
      name: 'Tee Sunset',
      description: null,
      material: 'Cotton 100%, 250gsm',
      careGuide: null,
      printMethod: null,
      colors: [
            { code: 'BLK', name: 'Đen', hexCode: '#000000', images: [{ url: '/den.jpg', altText: 'Đen' }] },
            { code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF', images: [{ url: '/trang.jpg', altText: 'Trắng' }] },
      ],
      sizes: [
            { name: 'S', sortOrder: 1 },
            { name: 'M', sortOrder: 2 },
            { name: 'L', sortOrder: 3 },
      ],
      variants: [
            { sku: 'TEE-SUNSET-BLK-S', colorCode: 'BLK', sizeName: 'S', price: '299000', inStock: true },
            { sku: 'TEE-SUNSET-BLK-M', colorCode: 'BLK', sizeName: 'M', price: '299000', inStock: false },
            { sku: 'TEE-SUNSET-BLK-L', colorCode: 'BLK', sizeName: 'L', price: '299000', inStock: true },
            { sku: 'TEE-SUNSET-WHT-S', colorCode: 'WHT', sizeName: 'S', price: '319000', inStock: true },
      ],
      sizeChart: null,
};

async function mountPage() {
      const wrapper = mount(ProductDetailPage, {
            props: { slug: 'tee-sunset' },
            global: {
                  // Tắt thử lại trong test: mặc định thử lại nhiều lần làm trạng thái
                  // lỗi xuất hiện muộn và test phải chờ vô ích.
                  plugins: [[VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
                  stubs: { RouterLink: { template: '<a><slot /></a>' } },
            },
      });

      await flushPromises();

      return wrapper;
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchProduct.mockResolvedValue({ data: DETAIL });
      fetchCart.mockResolvedValue(EMPTY_CART);
      addCartItem.mockResolvedValue({ cart: EMPTY_CART });
});

function findAddButton(wrapper: Awaited<ReturnType<typeof mountPage>>) {
      return wrapper.findAll('button').find((button) => button.text().startsWith('Thêm vào giỏ'));
}

async function selectSize(wrapper: Awaited<ReturnType<typeof mountPage>>, name: string): Promise<void> {
      await wrapper
            .findAll('button')
            .find((button) => button.text() === name)
            ?.trigger('click');
}

describe('ProductDetailPage', () => {
      test('size hết hàng bị vô hiệu hoá chứ không bị ẩn', async () => {
            // Ràng buộc R9. Ẩn đi khiến khách tưởng shop không bán size đó.
            const wrapper = await mountPage();

            const sizeButtons = wrapper.findAll('button').filter((button) => ['S', 'M', 'L'].includes(button.text()));

            expect(sizeButtons).toHaveLength(3);

            const outOfStock = sizeButtons.find((button) => button.text() === 'M');

            expect(outOfStock?.attributes('disabled')).toBeDefined();
            expect(outOfStock?.attributes('aria-disabled')).toBe('true');
      });

      test('size còn hàng không bị vô hiệu hoá', async () => {
            const wrapper = await mountPage();

            const inStock = wrapper.findAll('button').find((button) => button.text() === 'L');

            expect(inStock?.attributes('disabled')).toBeUndefined();
      });

      test('định dạng tiền theo quy ước Việt Nam từ chuỗi API trả về', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('299.000 ₫');
      });

      test('đổi swatch màu thì gallery đổi theo', async () => {
            const wrapper = await mountPage();

            expect(wrapper.find('img').attributes('src')).toBe('/den.jpg');

            const whiteSwatch = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Trắng');
            await whiteSwatch?.trigger('click');

            expect(wrapper.find('img').attributes('src')).toBe('/trang.jpg');
      });

      test('đổi màu thì tập size còn mua được đổi theo', async () => {
            // Màu Trắng chỉ có size S; hai size còn lại phải vô hiệu hoá.
            const wrapper = await mountPage();

            const whiteSwatch = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Trắng');
            await whiteSwatch?.trigger('click');

            const sizeL = wrapper.findAll('button').find((button) => button.text() === 'L');

            expect(sizeL?.attributes('disabled')).toBeDefined();
      });

      test('chưa chọn size thì nút thêm vào giỏ bị vô hiệu hoá', async () => {
            const wrapper = await mountPage();

            expect(findAddButton(wrapper)?.attributes('disabled')).toBeDefined();
            expect(wrapper.text()).toContain('Chọn size để thêm vào giỏ');
      });

      test('chọn size rồi thêm vào giỏ thì gửi đúng SKU của tổ hợp đang chọn', async () => {
            const wrapper = await mountPage();

            await selectSize(wrapper, 'L');
            await findAddButton(wrapper)?.trigger('click');
            await flushPromises();

            expect(addCartItem).toHaveBeenCalledWith('TEE-SUNSET-BLK-L', 1);
            expect(wrapper.text()).toContain('Đã thêm vào giỏ');
      });

      test('đổi màu sau khi thêm thì xác nhận cũ biến mất', async () => {
            const wrapper = await mountPage();

            await selectSize(wrapper, 'S');
            await findAddButton(wrapper)?.trigger('click');
            await flushPromises();

            const whiteSwatch = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Trắng');
            await whiteSwatch?.trigger('click');

            expect(wrapper.text()).not.toContain('Đã thêm vào giỏ');
      });

      test('số lượng bị chặn theo tồn thì hiện thông báo thay vì xác nhận suông', async () => {
            addCartItem.mockResolvedValue({ cart: EMPTY_CART, adjustedQuantity: 2 });

            const wrapper = await mountPage();

            await selectSize(wrapper, 'L');
            await findAddButton(wrapper)?.trigger('click');
            await flushPromises();

            expect(wrapper.text()).toContain('Kho chỉ còn 2 sản phẩm');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchProduct.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

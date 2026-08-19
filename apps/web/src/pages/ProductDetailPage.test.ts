import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { ProductDetail } from '@shopflow/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ProductDetailPage from './ProductDetailPage.vue';

const fetchProduct = vi.fn();

vi.mock('../api/catalog.js', () => ({
      fetchProduct: (slug: string) => fetchProduct(slug),
}));

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
      fetchProduct.mockResolvedValue({ data: DETAIL });
});

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

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchProduct.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { CatalogFilterOptions, ProductCard } from '@shopflow/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import ProductListPage from './ProductListPage.vue';

const fetchProducts = vi.fn();
const fetchFilterOptions = vi.fn();

vi.mock('../api/catalog.js', () => ({
      fetchProducts: (filters: unknown) => fetchProducts(filters),
      fetchFilterOptions: () => fetchFilterOptions(),
}));

const FILTER_OPTIONS: CatalogFilterOptions = {
      colors: [
            { code: 'BLK', name: 'Đen', hexCode: '#000000' },
            { code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF' },
      ],
      sizes: [
            { name: 'S', sortOrder: 1 },
            { name: 'L', sortOrder: 3 },
      ],
};

const CARDS: ProductCard[] = [
      {
            slug: 'tee-sunset',
            name: 'Tee Sunset',
            minPrice: '299000',
            colors: [{ code: 'BLK', name: 'Đen', hexCode: '#000000' }],
            inStock: true,
      },
];

function createTestRouter(): Router {
      return createRouter({
            history: createMemoryHistory(),
            routes: [
                  { path: '/', name: 'products', component: { template: '<div />' } },
                  { path: '/san-pham/:slug', name: 'product-detail', component: { template: '<div />' } },
            ],
      });
}

async function mountPage(initialUrl = '/') {
      const router = createTestRouter();
      await router.push(initialUrl);
      await router.isReady();

      const wrapper = mount(ProductListPage, {
            global: {
                  plugins: [router, [VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }]],
            },
      });

      await flushPromises();

      return { wrapper, router };
}

beforeEach(() => {
      fetchFilterOptions.mockResolvedValue({ data: FILTER_OPTIONS });
      fetchProducts.mockResolvedValue({ data: CARDS, meta: { page: 1, limit: 20, total: 1 } });
});

describe('ProductListPage', () => {
      test('định dạng tiền từ chuỗi API trả về', async () => {
            const { wrapper } = await mountPage();

            expect(wrapper.text()).toContain('299.000 ₫');
      });

      test('đọc bộ lọc từ URL chứ không giữ bản sao riêng', async () => {
            // URL là nguồn sự thật duy nhất: nhờ vậy tải lại trang giữ nguyên lựa chọn
            // và khách gửi được link kết quả lọc cho người khác.
            await mountPage('/?color=BLK&size=L&inStock=true');

            expect(fetchProducts).toHaveBeenCalledWith(expect.objectContaining({ color: 'BLK', size: 'L', inStock: true }));
      });

      test('bấm lọc màu thì URL đổi theo', async () => {
            const { wrapper, router } = await mountPage();

            const swatch = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Đen');
            await swatch?.trigger('click');
            await flushPromises();

            expect(router.currentRoute.value.query.color).toBe('BLK');
      });

      test('bấm lại vào bộ lọc đang bật thì bỏ lọc', async () => {
            const { wrapper, router } = await mountPage('/?color=BLK');

            const swatch = wrapper.findAll('button').find((button) => button.attributes('aria-label') === 'Đen');
            await swatch?.trigger('click');
            await flushPromises();

            expect(router.currentRoute.value.query.color).toBeUndefined();
      });

      test('hiển thị thông báo rỗng thay vì lưới trống khi không có kết quả', async () => {
            fetchProducts.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } });

            const { wrapper } = await mountPage();

            expect(wrapper.text()).toContain('Không có thiết kế nào khớp bộ lọc');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchProducts.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const { wrapper } = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

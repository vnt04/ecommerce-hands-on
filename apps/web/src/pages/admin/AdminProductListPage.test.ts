import type { AdminProductSummary } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AdminProductListPage from './AdminProductListPage.vue';

const fetchAdminProducts = vi.fn();
const push = vi.fn();
let routeQuery: Record<string, string> = {};

vi.mock('../../api/adminCatalog.js', () => ({
      fetchAdminProducts: (filters: unknown) => fetchAdminProducts(filters),
      fetchAdminProduct: vi.fn(),
      fetchCatalogAxes: vi.fn(),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      updateVariant: vi.fn(),
      adjustStock: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
      extendMatrix: vi.fn(),
      fetchVariantHistory: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRoute: () => ({ query: routeQuery }),
      useRouter: () => ({ push }),
}));

function summary(overrides: Partial<AdminProductSummary> = {}): AdminProductSummary {
      return {
            slug: 'tee-sunset',
            designCode: 'TEE-SUNSET',
            name: 'Tee Sunset',
            status: 'PUBLISHED',
            isArchived: false,
            variantCount: 6,
            activeVariantCount: 5,
            totalStock: 42,
            ...overrides,
      };
}

async function mountPage() {
      const wrapper = mount(AdminProductListPage, {
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
      fetchAdminProducts.mockResolvedValue({ items: [summary()], meta: { page: 1, limit: 20, total: 1 } });
});

describe('AdminProductListPage', () => {
      test('hiện mã thiết kế, số tổ hợp đang bán và tổng tồn', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('TEE-SUNSET');
            expect(wrapper.text()).toContain('5/6');
            expect(wrapper.text()).toContain('42');
      });

      test('đọc bộ lọc từ URL chứ không giữ bản sao riêng', async () => {
            routeQuery = { trang_thai: 'DRAFT', tim: 'sunset', gom_luu_tru: '1', trang: '2' };

            await mountPage();

            expect(fetchAdminProducts).toHaveBeenCalledWith(
                  expect.objectContaining({ status: 'DRAFT', search: 'sunset', includeArchived: true, page: 2 }),
            );
      });

      test('bấm tab trạng thái thì URL đổi theo và quay về trang một', async () => {
            routeQuery = { trang: '3' };

            const wrapper = await mountPage();
            await wrapper
                  .findAll('button')
                  .find((button) => button.text() === 'Bản nháp')
                  ?.trigger('click');

            expect(push).toHaveBeenCalledWith({ query: { trang: undefined, trang_thai: 'DRAFT' } });
      });

      test('bật ô gồm cả đã lưu trữ thì URL đổi theo', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[type="checkbox"]').setValue(true);

            expect(push).toHaveBeenCalledWith({ query: { gom_luu_tru: '1', trang: undefined } });
      });

      test('tổng tồn bằng 0 được tô đỏ để thấy ngay cái nào cần nhập thêm', async () => {
            fetchAdminProducts.mockResolvedValue({ items: [summary({ totalStock: 0 })], meta: { page: 1, limit: 20, total: 1 } });

            const wrapper = await mountPage();

            expect(wrapper.html()).toContain('text-red-600');
      });

      test('đánh dấu bản đã lưu trữ', async () => {
            fetchAdminProducts.mockResolvedValue({ items: [summary({ isArchived: true })], meta: { page: 1, limit: 20, total: 1 } });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Đã lưu trữ');
      });

      test('không có thiết kế nào khớp thì báo rõ thay vì bảng trống', async () => {
            fetchAdminProducts.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Không có thiết kế nào khớp bộ lọc');
      });

      test('nhiều trang thì hiện điều khiển phân trang', async () => {
            fetchAdminProducts.mockResolvedValue({ items: [summary()], meta: { page: 1, limit: 20, total: 45 } });

            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Trang 1 trên 3');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchAdminProducts.mockRejectedValue(new Error('Không kết nối được máy chủ'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

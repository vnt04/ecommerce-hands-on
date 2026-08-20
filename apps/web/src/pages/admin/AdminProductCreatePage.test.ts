import type { CatalogAxes } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '../../api/client.js';
import AdminProductCreatePage from './AdminProductCreatePage.vue';

const fetchCatalogAxes = vi.fn();
const createProduct = vi.fn();
const push = vi.fn();

vi.mock('../../api/adminCatalog.js', () => ({
      fetchCatalogAxes: () => fetchCatalogAxes(),
      createProduct: (input: unknown) => createProduct(input),
      fetchAdminProducts: vi.fn(),
      fetchAdminProduct: vi.fn(),
      updateProduct: vi.fn(),
      updateVariant: vi.fn(),
      adjustStock: vi.fn(),
      uploadImage: vi.fn(),
      removeImage: vi.fn(),
      extendMatrix: vi.fn(),
      fetchVariantHistory: vi.fn(),
}));

vi.mock('vue-router', () => ({
      useRouter: () => ({ push }),
      useRoute: () => ({ query: {} }),
}));

const AXES: CatalogAxes = {
      categories: [{ id: '1', slug: 'ao-thun', name: 'Áo thun' }],
      colors: [
            { id: '1', code: 'BLK', name: 'Đen', hexCode: '#000000' },
            { id: '2', code: 'WHT', name: 'Trắng', hexCode: '#FFFFFF' },
      ],
      sizes: [
            { id: '1', name: 'S', sortOrder: 1 },
            { id: '2', name: 'M', sortOrder: 2 },
            { id: '3', name: 'L', sortOrder: 3 },
      ],
};

async function mountPage() {
      const wrapper = mount(AdminProductCreatePage, {
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

async function fillValidForm(wrapper: Page): Promise<void> {
      const inputs = wrapper.findAll('input');
      // Thứ tự ô nhập: tên, mã thiết kế, slug, giá, tồn ban đầu.
      await inputs[0]?.setValue('Tee Sunset');
      await inputs[1]?.setValue('TEE-SUNSET');
      await inputs[2]?.setValue('tee-sunset');
      await wrapper.find('select').setValue('1');
      await buttonWithText(wrapper, 'Đen')?.trigger('click');
      await buttonWithText(wrapper, 'S')?.trigger('click');
      await wrapper.find('input[placeholder="299000"]').setValue('299000');
}

beforeEach(() => {
      vi.clearAllMocks();
      fetchCatalogAxes.mockResolvedValue(AXES);
      createProduct.mockResolvedValue({ slug: 'tee-sunset' });
});

describe('AdminProductCreatePage', () => {
      test('hiện màu và size lấy từ máy chủ', async () => {
            const wrapper = await mountPage();

            expect(buttonWithText(wrapper, 'Đen')).toBeDefined();
            expect(buttonWithText(wrapper, 'L')).toBeDefined();
      });

      test('xem trước số tổ hợp sẽ sinh ra trước khi bấm tạo', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('Sẽ sinh 0 tổ hợp');

            await buttonWithText(wrapper, 'Đen')?.trigger('click');
            await buttonWithText(wrapper, 'Trắng')?.trigger('click');
            await buttonWithText(wrapper, 'S')?.trigger('click');
            await buttonWithText(wrapper, 'M')?.trigger('click');
            await buttonWithText(wrapper, 'L')?.trigger('click');

            // 2 màu × 3 size = 6.
            expect(wrapper.text()).toContain('Sẽ sinh 6 tổ hợp');
      });

      test('bấm lại vào màu đang chọn thì bỏ chọn', async () => {
            const wrapper = await mountPage();

            await buttonWithText(wrapper, 'Đen')?.trigger('click');
            await buttonWithText(wrapper, 'S')?.trigger('click');
            expect(wrapper.text()).toContain('Sẽ sinh 1 tổ hợp');

            await buttonWithText(wrapper, 'Đen')?.trigger('click');
            expect(wrapper.text()).toContain('Sẽ sinh 0 tổ hợp');
      });

      test('gợi ý slug từ tên, bỏ dấu tiếng Việt', async () => {
            const wrapper = await mountPage();
            const inputs = wrapper.findAll('input');

            await inputs[0]?.setValue('Áo thun Mùa Hè');
            await inputs[0]?.trigger('blur');

            expect((inputs[2]?.element as HTMLInputElement).value).toBe('ao-thun-mua-he');
      });

      test('chưa chọn màu hoặc size thì bị chặn tại chỗ, không gọi API', async () => {
            const wrapper = await mountPage();
            const inputs = wrapper.findAll('input');

            await inputs[0]?.setValue('Tee Sunset');
            await inputs[1]?.setValue('TEE-SUNSET');
            await inputs[2]?.setValue('tee-sunset');
            await wrapper.find('select').setValue('1');
            await wrapper.find('input[placeholder="299000"]').setValue('299000');

            await wrapper.find('form').trigger('submit');
            await flushPromises();

            expect(createProduct).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Chọn ít nhất một màu');
      });

      test('mã thiết kế sai định dạng bị chặn tại chỗ', async () => {
            const wrapper = await mountPage();

            await fillValidForm(wrapper);
            await wrapper.findAll('input')[1]?.setValue('sai dinh dang');
            await wrapper.find('form').trigger('submit');
            await flushPromises();

            expect(createProduct).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Mã thiết kế gồm chữ in hoa');
      });

      test('gửi đúng dữ liệu rồi chuyển sang trang thiết kế vừa tạo', async () => {
            const wrapper = await mountPage();

            await fillValidForm(wrapper);
            await wrapper.find('form').trigger('submit');
            await flushPromises();

            expect(createProduct).toHaveBeenCalledWith(
                  expect.objectContaining({
                        designCode: 'TEE-SUNSET',
                        slug: 'tee-sunset',
                        colorIds: ['1'],
                        sizeIds: ['1'],
                        defaultPrice: '299000',
                  }),
            );
            expect(push).toHaveBeenCalledWith('/quan-tri/thiet-ke/tee-sunset');
      });

      test('máy chủ báo trùng mã thì hiện thông báo của máy chủ', async () => {
            createProduct.mockRejectedValue(new ApiError('CONFLICT', 'Mã thiết kế đã tồn tại'));

            const wrapper = await mountPage();
            await fillValidForm(wrapper);
            await wrapper.find('form').trigger('submit');
            await flushPromises();

            expect(wrapper.find('[role="alert"]').text()).toContain('Mã thiết kế đã tồn tại');
      });
});

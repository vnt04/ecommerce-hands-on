import type { AdminProductDetail } from '@shopflow/shared';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '../../api/client.js';
import AdminProductDetailPage from './AdminProductDetailPage.vue';

const fetchAdminProduct = vi.fn();
const updateProduct = vi.fn();
const updateVariant = vi.fn();
const adjustStock = vi.fn();
const uploadImage = vi.fn();
const removeImage = vi.fn();

vi.mock('../../api/adminCatalog.js', () => ({
      fetchAdminProduct: (slug: string) => fetchAdminProduct(slug),
      updateProduct: (slug: string, change: unknown) => updateProduct(slug, change),
      updateVariant: (sku: string, change: unknown) => updateVariant(sku, change),
      adjustStock: (sku: string, delta: number, reason?: string) => adjustStock(sku, delta, reason),
      uploadImage: (input: unknown) => uploadImage(input),
      removeImage: (id: string) => removeImage(id),
      fetchAdminProducts: vi.fn(),
      fetchCatalogAxes: vi.fn(),
      createProduct: vi.fn(),
      extendMatrix: vi.fn(),
      fetchVariantHistory: vi.fn(),
}));

function productOf(overrides: Partial<AdminProductDetail> = {}): AdminProductDetail {
      return {
            slug: 'tee-sunset',
            designCode: 'TEE-SUNSET',
            name: 'Tee Sunset',
            description: null,
            material: null,
            careGuide: null,
            printMethod: null,
            status: 'DRAFT',
            isArchived: false,
            categoryName: 'Áo thun',
            variants: [
                  {
                        sku: 'TEE-SUNSET-BLK-S',
                        colorCode: 'BLK',
                        colorName: 'Đen',
                        colorHex: '#000000',
                        sizeName: 'S',
                        price: '299000',
                        stockQuantity: 8,
                        isActive: true,
                  },
                  {
                        sku: 'TEE-SUNSET-BLK-M',
                        colorCode: 'BLK',
                        colorName: 'Đen',
                        colorHex: '#000000',
                        sizeName: 'M',
                        price: '299000',
                        stockQuantity: 0,
                        isActive: true,
                  },
            ],
            images: [],
            ...overrides,
      };
}

async function mountPage() {
      const wrapper = mount(AdminProductDetailPage, {
            props: { slug: 'tee-sunset' },
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
      fetchAdminProduct.mockResolvedValue(productOf());
      updateProduct.mockResolvedValue(productOf({ status: 'PUBLISHED' }));
      updateVariant.mockResolvedValue([]);
      adjustStock.mockResolvedValue({ sku: 'TEE-SUNSET-BLK-S', stockAfter: 18 });
      uploadImage.mockResolvedValue({ id: '1', url: '/anh.png', altText: null, colorCode: null });
      removeImage.mockResolvedValue(undefined);
});

describe('AdminProductDetailPage', () => {
      test('hiện bảng tổ hợp kèm SKU, giá và tồn', async () => {
            const wrapper = await mountPage();

            expect(wrapper.text()).toContain('TEE-SUNSET-BLK-S');
            expect(wrapper.text()).toContain('Tổ hợp (2)');
            expect(wrapper.text()).toContain('299.000 ₫');
      });

      test('bản nháp có nút xuất bản, đang bán thì không', async () => {
            const draft = await mountPage();
            expect(buttonWithText(draft, 'Xuất bản')).toBeDefined();

            fetchAdminProduct.mockResolvedValue(productOf({ status: 'PUBLISHED' }));
            const published = await mountPage();
            expect(buttonWithText(published, 'Xuất bản')).toBeUndefined();
            expect(buttonWithText(published, 'Chuyển về bản nháp')).toBeDefined();
      });

      test('xuất bản gọi API với trạng thái mới', async () => {
            const wrapper = await mountPage();

            await buttonWithText(wrapper, 'Xuất bản')?.trigger('click');
            await flushPromises();

            expect(updateProduct).toHaveBeenCalledWith('tee-sunset', { status: 'PUBLISHED' });
      });

      test('lưu trữ thay cho xoá, và nhãn đổi theo trạng thái hiện tại', async () => {
            const wrapper = await mountPage();
            expect(buttonWithText(wrapper, 'Lưu trữ')).toBeDefined();

            fetchAdminProduct.mockResolvedValue(productOf({ isArchived: true }));
            const archived = await mountPage();
            expect(buttonWithText(archived, 'Bỏ lưu trữ')).toBeDefined();
      });

      test('nhập tồn gửi lượng cộng thêm chứ không gửi số cuối', async () => {
            // Đây là quyết định 2 của S09b, thể hiện ở tầng giao diện.
            const wrapper = await mountPage();

            const stockInput = wrapper.find('input[aria-label="Lượng nhập thêm cho TEE-SUNSET-BLK-S"]');
            await stockInput.setValue('10');
            await buttonWithText(wrapper, 'Ghi')?.trigger('click');
            await flushPromises();

            expect(adjustStock).toHaveBeenCalledWith('TEE-SUNSET-BLK-S', 10, undefined);
      });

      test('hiện tồn trước và tồn sau ngay khi gõ lượng nhập', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[aria-label="Lượng nhập thêm cho TEE-SUNSET-BLK-S"]').setValue('10');

            // Tồn đang là 8, nhập thêm 10 thì thành 18.
            expect(wrapper.text()).toContain('→ 18');
      });

      test('lý do được gửi kèm thao tác nhập tồn', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[placeholder="Nhập hàng đợt 3, tăng giá vải…"]').setValue('Nhập hàng đợt 3');
            await wrapper.find('input[aria-label="Lượng nhập thêm cho TEE-SUNSET-BLK-S"]').setValue('5');
            await buttonWithText(wrapper, 'Ghi')?.trigger('click');
            await flushPromises();

            expect(adjustStock).toHaveBeenCalledWith('TEE-SUNSET-BLK-S', 5, 'Nhập hàng đợt 3');
      });

      test('chưa gõ lượng nhập thì nút ghi bị vô hiệu hoá', async () => {
            const wrapper = await mountPage();

            expect(buttonWithText(wrapper, 'Ghi')?.attributes('disabled')).toBeDefined();
      });

      test('đổi giá chỉ hiện nút lưu khi giá thực sự khác', async () => {
            const wrapper = await mountPage();

            expect(buttonWithText(wrapper, 'Lưu')).toBeUndefined();

            await wrapper.find('input[aria-label="Giá TEE-SUNSET-BLK-S"]').setValue('350000');
            expect(buttonWithText(wrapper, 'Lưu')).toBeDefined();
      });

      test('lưu giá gửi giá mới kèm lý do', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[placeholder="Nhập hàng đợt 3, tăng giá vải…"]').setValue('Tăng giá vải');
            await wrapper.find('input[aria-label="Giá TEE-SUNSET-BLK-S"]').setValue('350000');
            await buttonWithText(wrapper, 'Lưu')?.trigger('click');
            await flushPromises();

            expect(updateVariant).toHaveBeenCalledWith('TEE-SUNSET-BLK-S', { price: '350000', reason: 'Tăng giá vải' });
      });

      test('bật tắt tổ hợp gọi API với trạng thái mới', async () => {
            const wrapper = await mountPage();

            await wrapper.find('input[aria-label="Bán TEE-SUNSET-BLK-S"]').setValue(false);
            await flushPromises();

            expect(updateVariant).toHaveBeenCalledWith('TEE-SUNSET-BLK-S', { isActive: false });
      });

      test('máy chủ từ chối thao tác thì hiện thông báo của máy chủ', async () => {
            adjustStock.mockRejectedValue(new ApiError('CONFLICT', 'Kho chỉ còn 8 sản phẩm, không giảm được 9999'));

            const wrapper = await mountPage();
            await wrapper.find('input[aria-label="Lượng nhập thêm cho TEE-SUNSET-BLK-S"]').setValue('-9999');
            await buttonWithText(wrapper, 'Ghi')?.trigger('click');
            await flushPromises();

            expect(wrapper.find('[role="alert"]').text()).toContain('không giảm được 9999');
      });

      test('gỡ ảnh gọi API với đúng mã ảnh', async () => {
            fetchAdminProduct.mockResolvedValue(
                  productOf({ images: [{ id: '7', url: '/anh.png', altText: 'Ảnh đen', colorCode: 'BLK' }] }),
            );

            const wrapper = await mountPage();
            await buttonWithText(wrapper, 'Gỡ ảnh')?.trigger('click');
            await flushPromises();

            expect(removeImage).toHaveBeenCalledWith('7');
      });

      test('hiển thị trạng thái lỗi thay vì trang trắng khi API hỏng', async () => {
            fetchAdminProduct.mockRejectedValue(new Error('Không tìm thấy thiết kế'));

            const wrapper = await mountPage();
            await flushPromises();

            expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      });
});

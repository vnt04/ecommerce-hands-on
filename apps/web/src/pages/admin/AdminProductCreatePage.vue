<script setup lang="ts">
import { formatVndFromJson } from '@shopflow/shared';
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { createProduct, fetchCatalogAxes } from '../../api/adminCatalog.js';
import { ApiError } from '../../api/client.js';
import QueryState from '../../components/QueryState.vue';

const router = useRouter();

const axesQuery = useQuery({ queryKey: ['catalog-axes'], queryFn: fetchCatalogAxes });
const axes = computed(() => axesQuery.data.value);

const form = ref({
      categoryId: '',
      designCode: '',
      slug: '',
      name: '',
      description: '',
      material: '',
      defaultPrice: '',
      defaultStockQuantity: 0,
});

const selectedColorIds = ref<string[]>([]);
const selectedSizeIds = ref<string[]>([]);

const isSubmitting = ref(false);
const submitError = ref<string | undefined>(undefined);
const invalidFields = ref<string[]>([]);

/**
 * Số biến thể sẽ sinh ra, tính ngay khi người dùng chọn.
 *
 * Ba màu nhân năm size là mười lăm dòng trong cơ sở dữ liệu. Cho biết con số đó
 * trước khi bấm tạo, thay vì để họ phát hiện sau khi đã tạo xong.
 */
const variantCount = computed(() => selectedColorIds.value.length * selectedSizeIds.value.length);

/** Bật tắt một phần tử trong danh sách đang chọn, luôn trả về mảng mới. */
function toggled(current: readonly string[], id: string): string[] {
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function toggleColor(id: string): void {
      selectedColorIds.value = toggled(selectedColorIds.value, id);
}

function toggleSize(id: string): void {
      selectedSizeIds.value = toggled(selectedSizeIds.value, id);
}

/** Gợi ý slug từ tên, nhưng người dùng vẫn sửa được. */
function suggestSlug(): void {
      if (form.value.slug !== '') {
            return;
      }

      form.value.slug = form.value.name
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
}

const FIELD_MESSAGES: Record<string, string> = {
      categoryId: 'Chọn danh mục',
      designCode: 'Mã thiết kế gồm chữ in hoa, số và dấu gạch ngang, ít nhất 3 ký tự',
      slug: 'Slug gồm chữ thường, số và dấu gạch ngang, ít nhất 3 ký tự',
      name: 'Nhập tên thiết kế',
      defaultPrice: 'Nhập giá, đơn vị đồng',
      colorIds: 'Chọn ít nhất một màu',
      sizeIds: 'Chọn ít nhất một size',
};

function messageFor(field: string): string | undefined {
      return invalidFields.value.includes(field) ? FIELD_MESSAGES[field] : undefined;
}

function validate(): boolean {
      const invalid: string[] = [];

      if (form.value.categoryId === '') {
            invalid.push('categoryId');
      }

      if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(form.value.designCode)) {
            invalid.push('designCode');
      }

      if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(form.value.slug)) {
            invalid.push('slug');
      }

      if (form.value.name.trim().length < 2) {
            invalid.push('name');
      }

      if (!/^\d+$/.test(form.value.defaultPrice)) {
            invalid.push('defaultPrice');
      }

      if (selectedColorIds.value.length === 0) {
            invalid.push('colorIds');
      }

      if (selectedSizeIds.value.length === 0) {
            invalid.push('sizeIds');
      }

      invalidFields.value = invalid;

      return invalid.length === 0;
}

async function submit(): Promise<void> {
      submitError.value = undefined;

      if (!validate() || isSubmitting.value) {
            return;
      }

      isSubmitting.value = true;

      try {
            const created = await createProduct({
                  categoryId: form.value.categoryId,
                  designCode: form.value.designCode,
                  slug: form.value.slug,
                  name: form.value.name,
                  description: form.value.description || undefined,
                  material: form.value.material || undefined,
                  colorIds: selectedColorIds.value,
                  sizeIds: selectedSizeIds.value,
                  defaultPrice: form.value.defaultPrice,
                  defaultStockQuantity: form.value.defaultStockQuantity,
            });

            await router.push('/quan-tri/thiet-ke/' + created.slug);
      } catch (caught: unknown) {
            if (!(caught instanceof ApiError)) {
                  throw caught;
            }

            const detail = caught.details as { fields?: string[] } | undefined;
            invalidFields.value = detail?.fields ?? [];
            submitError.value = caught.message;
      } finally {
            isSubmitting.value = false;
      }
}
</script>

<template>
      <QueryState :is-pending="axesQuery.isPending.value" :error="axesQuery.error.value" :is-empty="false">
            <section v-if="axes">
                  <RouterLink to="/quan-tri/thiet-ke" class="text-sm text-gray-500 hover:underline">← Tất cả thiết kế</RouterLink>
                  <h1 class="mt-2 text-2xl font-bold text-brand">Tạo thiết kế</h1>

                  <form class="mt-6 max-w-2xl" novalidate @submit.prevent="submit()">
                        <label class="block">
                              <span class="text-sm font-semibold text-gray-700">Tên thiết kế</span>
                              <input
                                    v-model="form.name"
                                    type="text"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    :aria-invalid="invalidFields.includes('name')"
                                    @blur="suggestSlug()"
                              />
                              <span v-if="messageFor('name')" class="text-sm text-red-600">{{ messageFor('name') }}</span>
                        </label>

                        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label class="block">
                                    <span class="text-sm font-semibold text-gray-700">Mã thiết kế</span>
                                    <input
                                          v-model="form.designCode"
                                          type="text"
                                          placeholder="TEE-SUNSET"
                                          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono"
                                          :aria-invalid="invalidFields.includes('designCode')"
                                    />
                                    <!-- ADR-006: SKU sinh từ mã này, nên đổi tên sau không kéo theo đổi SKU. -->
                                    <span class="text-xs text-gray-500">SKU sinh từ mã này và không đổi về sau</span>
                                    <span v-if="messageFor('designCode')" class="block text-sm text-red-600">
                                          {{ messageFor('designCode') }}
                                    </span>
                              </label>

                              <label class="block">
                                    <span class="text-sm font-semibold text-gray-700">Slug</span>
                                    <input
                                          v-model="form.slug"
                                          type="text"
                                          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono"
                                          :aria-invalid="invalidFields.includes('slug')"
                                    />
                                    <span class="text-xs text-gray-500">Đường dẫn trang sản phẩm</span>
                                    <span v-if="messageFor('slug')" class="block text-sm text-red-600">{{ messageFor('slug') }}</span>
                              </label>
                        </div>

                        <label class="mt-4 block">
                              <span class="text-sm font-semibold text-gray-700">Danh mục</span>
                              <select
                                    v-model="form.categoryId"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    :aria-invalid="invalidFields.includes('categoryId')"
                              >
                                    <option value="">Chọn danh mục</option>
                                    <option v-for="category in axes.categories" :key="category.id" :value="category.id">
                                          {{ category.name }}
                                    </option>
                              </select>
                              <span v-if="messageFor('categoryId')" class="text-sm text-red-600">{{ messageFor('categoryId') }}</span>
                        </label>

                        <fieldset class="mt-6">
                              <legend class="text-sm font-semibold text-gray-700">Màu</legend>
                              <div class="mt-2 flex flex-wrap gap-2">
                                    <button
                                          v-for="color in axes.colors"
                                          :key="color.id"
                                          type="button"
                                          class="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                                          :class="selectedColorIds.includes(color.id) ? 'border-brand bg-brand/10' : 'border-gray-300'"
                                          :aria-pressed="selectedColorIds.includes(color.id)"
                                          @click="toggleColor(color.id)"
                                    >
                                          <span
                                                class="size-4 rounded-full border border-gray-300"
                                                :style="{ backgroundColor: color.hexCode }"
                                          />
                                          {{ color.name }}
                                    </button>
                              </div>
                              <span v-if="messageFor('colorIds')" class="text-sm text-red-600">{{ messageFor('colorIds') }}</span>
                        </fieldset>

                        <fieldset class="mt-6">
                              <legend class="text-sm font-semibold text-gray-700">Size</legend>
                              <div class="mt-2 flex flex-wrap gap-2">
                                    <button
                                          v-for="size in axes.sizes"
                                          :key="size.id"
                                          type="button"
                                          class="min-w-12 rounded border px-3 py-2 text-sm"
                                          :class="
                                                selectedSizeIds.includes(size.id) ? 'border-brand bg-brand text-white' : 'border-gray-300'
                                          "
                                          :aria-pressed="selectedSizeIds.includes(size.id)"
                                          @click="toggleSize(size.id)"
                                    >
                                          {{ size.name }}
                                    </button>
                              </div>
                              <span v-if="messageFor('sizeIds')" class="text-sm text-red-600">{{ messageFor('sizeIds') }}</span>
                        </fieldset>

                        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label class="block">
                                    <span class="text-sm font-semibold text-gray-700">Giá mặc định</span>
                                    <input
                                          v-model="form.defaultPrice"
                                          type="text"
                                          inputmode="numeric"
                                          placeholder="299000"
                                          class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                          :aria-invalid="invalidFields.includes('defaultPrice')"
                                    />
                                    <span v-if="/^\d+$/.test(form.defaultPrice)" class="text-xs text-gray-500">
                                          {{ formatVndFromJson(form.defaultPrice) }}
                                    </span>
                                    <span v-if="messageFor('defaultPrice')" class="block text-sm text-red-600">
                                          {{ messageFor('defaultPrice') }}
                                    </span>
                              </label>

                              <label class="block">
                                    <span class="text-sm font-semibold text-gray-700">Tồn ban đầu mỗi tổ hợp</span>
                                    <input
                                          v-model.number="form.defaultStockQuantity"
                                          type="number"
                                          min="0"
                                          class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    />
                              </label>
                        </div>

                        <p class="mt-6 rounded bg-gray-50 p-3 text-sm text-gray-700">
                              Sẽ sinh <strong>{{ variantCount }}</strong> tổ hợp ({{ selectedColorIds.length }} màu ×
                              {{ selectedSizeIds.length }} size). Thiết kế mới ở trạng thái bản nháp, chưa hiện với khách.
                        </p>

                        <p v-if="submitError" class="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{{ submitError }}</p>

                        <button
                              type="submit"
                              class="mt-4 rounded bg-brand px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                              :disabled="isSubmitting"
                        >
                              {{ isSubmitting ? 'Đang tạo…' : 'Tạo thiết kế' }}
                        </button>
                  </form>
            </section>
      </QueryState>
</template>

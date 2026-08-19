<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { formatVndFromJson } from '@shopflow/shared';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { fetchFilterOptions, fetchProducts } from '../api/catalog.js';
import QueryState from '../components/QueryState.vue';

const route = useRoute();
const router = useRouter();

function readParam(name: string): string | undefined {
      const value = route.query[name];

      return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * URL là nguồn sự thật duy nhất của bộ lọc.
 *
 * Không giữ bản sao trong component: giữ hai bản rồi đồng bộ hai chiều là cách
 * chắc chắn nhất để sinh vòng lặp cập nhật. Đổi lại, tải lại trang giữ nguyên lựa
 * chọn, nút quay lại hoạt động đúng, và khách gửi được link kết quả lọc.
 */
const filters = computed(() => ({
      color: readParam('color'),
      size: readParam('size'),
      inStock: readParam('inStock') === 'true',
      page: Number(readParam('page') ?? '1'),
}));

function setFilter(name: string, value: string | undefined): void {
      const query = { ...route.query, [name]: value, page: undefined };

      void router.push({ query });
}

const options = useQuery({
      queryKey: ['catalog-filters'],
      queryFn: async () => (await fetchFilterOptions()).data,
});

const products = useQuery({
      // Khoá chứa bộ lọc nên đổi bộ lọc là tự tải lại, không phải tự viết logic đó.
      queryKey: computed(() => ['products', filters.value]),
      queryFn: async () => fetchProducts(filters.value),
});

const items = computed(() => products.data.value?.data ?? []);
const meta = computed(() => products.data.value?.meta);
const totalPages = computed(() => (meta.value === undefined ? 1 : Math.max(1, Math.ceil(meta.value.total / meta.value.limit))));

function goToPage(page: number): void {
      void router.push({ query: { ...route.query, page: String(page) } });
}
</script>

<template>
      <section>
            <h1 class="text-2xl font-bold text-brand">Thiết kế</h1>

            <div v-if="options.data.value" class="mt-4 flex flex-wrap gap-6">
                  <fieldset>
                        <legend class="text-sm font-semibold text-gray-700">Màu</legend>
                        <div class="mt-2 flex gap-2">
                              <button
                                    v-for="color in options.data.value.colors"
                                    :key="color.code"
                                    type="button"
                                    class="size-8 rounded-full border-2 transition"
                                    :class="filters.color === color.code ? 'border-brand scale-110' : 'border-gray-300'"
                                    :style="{ backgroundColor: color.hexCode }"
                                    :aria-label="color.name"
                                    :aria-pressed="filters.color === color.code"
                                    @click="setFilter('color', filters.color === color.code ? undefined : color.code)"
                              />
                        </div>
                  </fieldset>

                  <fieldset>
                        <legend class="text-sm font-semibold text-gray-700">Size</legend>
                        <div class="mt-2 flex gap-2">
                              <button
                                    v-for="size in options.data.value.sizes"
                                    :key="size.name"
                                    type="button"
                                    class="min-w-11 rounded border px-3 py-1 text-sm"
                                    :class="filters.size === size.name ? 'border-brand bg-brand text-white' : 'border-gray-300'"
                                    :aria-pressed="filters.size === size.name"
                                    @click="setFilter('size', filters.size === size.name ? undefined : size.name)"
                              >
                                    {{ size.name }}
                              </button>
                        </div>
                  </fieldset>

                  <fieldset>
                        <legend class="text-sm font-semibold text-gray-700">Tình trạng</legend>
                        <label class="mt-2 flex items-center gap-2 text-sm">
                              <input
                                    type="checkbox"
                                    :checked="filters.inStock"
                                    @change="setFilter('inStock', filters.inStock ? undefined : 'true')"
                              />
                              Chỉ hiện còn hàng
                        </label>
                  </fieldset>
            </div>

            <QueryState
                  class="mt-6"
                  :is-pending="products.isPending.value"
                  :error="products.error.value"
                  :is-empty="items.length === 0"
                  empty-message="Không có thiết kế nào khớp bộ lọc"
            >
                  <ul class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <li v-for="product in items" :key="product.slug" class="rounded border border-gray-200 p-4">
                              <RouterLink :to="{ name: 'product-detail', params: { slug: product.slug } }" class="block">
                                    <h2 class="font-semibold">{{ product.name }}</h2>
                                    <p class="mt-1 text-lg">{{ formatVndFromJson(product.minPrice) }}</p>

                                    <div class="mt-2 flex gap-1">
                                          <span
                                                v-for="color in product.colors"
                                                :key="color.code"
                                                class="size-4 rounded-full border border-gray-300"
                                                :style="{ backgroundColor: color.hexCode }"
                                                :title="color.name"
                                          />
                                    </div>

                                    <p v-if="!product.inStock" class="mt-2 text-sm text-gray-500">Tạm hết hàng</p>
                              </RouterLink>
                        </li>
                  </ul>

                  <nav v-if="totalPages > 1" class="mt-8 flex justify-center gap-2" aria-label="Phân trang">
                        <button
                              v-for="page in totalPages"
                              :key="page"
                              type="button"
                              class="min-w-10 rounded border px-3 py-1"
                              :class="page === filters.page ? 'border-brand bg-brand text-white' : 'border-gray-300'"
                              :aria-current="page === filters.page ? 'page' : undefined"
                              @click="goToPage(page)"
                        >
                              {{ page }}
                        </button>
                  </nav>
            </QueryState>
      </section>
</template>

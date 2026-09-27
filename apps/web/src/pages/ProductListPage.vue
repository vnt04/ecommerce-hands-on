<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { formatVndFromJson } from '@shopflow/shared';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { fetchFilterOptions, fetchProducts } from '../api/catalog.js';
import QueryState from '../components/QueryState.vue';
import { demoProductImage } from '../data/demoProductImages.js';

const route = useRoute();
const router = useRouter();

function readParam(name: string): string | undefined {
      const value = route.query[name];

      return typeof value === 'string' && value !== '' ? value : undefined;
}

const searchInput = ref(readParam('q') ?? '');

watch(
      () => route.query.q,
      (value) => {
            searchInput.value = typeof value === 'string' ? value : '';
      },
);

function searchProducts(event: SubmitEvent): void {
      event.preventDefault();
      const q = searchInput.value.trim() || undefined;

      void router.push({ query: { ...route.query, q, page: undefined } });
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
      q: readParam('q'),
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
const hasPreviousPage = computed(() => filters.value.page > 1);
const hasNextPage = computed(() => filters.value.page < totalPages.value);
const visiblePages = computed(() => {
      const current = Math.min(Math.max(filters.value.page, 1), totalPages.value);
      const first = Math.max(1, Math.min(current - 1, totalPages.value - 2));

      return Array.from({ length: Math.min(3, totalPages.value) }, (_, index) => first + index);
});

function goToPage(page: number): void {
      void router.push({ query: { ...route.query, page: page === 1 ? undefined : String(page) } });
}
</script>

<template>
      <section class="storefront-page -mb-10 -mt-6 bg-white text-gray-900 sm:-mt-10">
            <div class="mx-auto max-w-7xl px-5 pb-12 pt-16 text-center sm:px-8 sm:pb-16 sm:pt-24">
                  <p class="text-xs font-semibold uppercase tracking-[0.32em] text-gray-500">SHOPFLOW · BỘ SƯU TẬP ÁO THUN</p>
                  <h1
                        class="mx-auto mt-6 max-w-5xl font-sans text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
                  >
                        Mặc theo cách của bạn
                  </h1>
                  <p class="mx-auto mt-5 max-w-2xl text-lg leading-7 text-gray-600 sm:text-xl">Chất riêng, phong cách riêng</p>
                  <a
                        href="#catalog"
                        class="mt-8 inline-flex items-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#263a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                        Khám phá bộ sưu tập <span class="ml-2" aria-hidden="true">↓</span>
                  </a>
            </div>

            <div id="catalog" class="catalog-content pb-16 sm:pb-20">
                  <div class="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">Catalog áo thun</p>
                              <h2 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Chọn mẫu bạn thích</h2>
                        </div>
                        <p v-if="meta" class="text-sm text-gray-500">{{ meta.total }} mẫu áo</p>
                  </div>

                  <form class="mt-6 flex max-w-2xl gap-2" role="search" @submit="searchProducts">
                        <label class="sr-only" for="product-search">Tìm thiết kế</label>
                        <input
                              id="product-search"
                              v-model="searchInput"
                              type="search"
                              name="q"
                              placeholder="Tìm theo tên mẫu áo…"
                              class="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand"
                        />
                        <button
                              type="submit"
                              class="rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand transition hover:bg-brand hover:text-white"
                        >
                              Tìm kiếm
                        </button>
                  </form>

                  <div v-if="options.data.value" class="mt-6 flex flex-wrap items-start gap-x-10 gap-y-5">
                        <fieldset>
                              <legend class="text-sm font-semibold text-gray-700">Màu</legend>
                              <div class="mt-2 flex max-w-full flex-wrap gap-2">
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
                              <div class="mt-2 flex flex-wrap gap-2">
                                    <button
                                          v-for="size in options.data.value.sizes"
                                          :key="size.name"
                                          type="button"
                                          class="min-w-11 rounded border px-3 py-1 text-sm"
                                          :class="
                                                filters.size === size.name
                                                      ? 'border-brand bg-brand text-white'
                                                      : 'border-gray-300 text-gray-800'
                                          "
                                          :aria-pressed="filters.size === size.name"
                                          @click="setFilter('size', filters.size === size.name ? undefined : size.name)"
                                    >
                                          {{ size.name }}
                                    </button>
                              </div>
                        </fieldset>

                        <fieldset>
                              <legend class="text-sm font-semibold text-gray-700">Tình trạng</legend>
                              <label class="mt-2 flex items-center gap-2 text-sm text-gray-700">
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
                        class="mt-8"
                        :is-pending="products.isPending.value"
                        :error="products.error.value"
                        :is-empty="items.length === 0"
                        empty-message="Không có thiết kế nào khớp bộ lọc"
                  >
                        <ul class="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 lg:gap-y-10">
                              <li v-for="product in items" :key="product.slug" class="group min-w-0">
                                    <RouterLink
                                          :to="{ name: 'product-detail', params: { slug: product.slug } }"
                                          class="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                                    >
                                          <div class="relative overflow-hidden rounded-xl bg-[#e8e5df]">
                                                <img
                                                      v-if="demoProductImage(product.slug)"
                                                      :src="demoProductImage(product.slug)"
                                                      :alt="'Ảnh minh họa ' + product.name"
                                                      class="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                                      loading="lazy"
                                                />
                                                <div
                                                      v-else
                                                      class="flex aspect-square items-center justify-center px-6 text-center text-sm text-gray-600"
                                                >
                                                      Ảnh sản phẩm đang được cập nhật
                                                </div>
                                                <span
                                                      v-if="!product.inStock"
                                                      class="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700"
                                                >
                                                      Tạm hết hàng
                                                </span>
                                          </div>
                                          <div class="flex items-start justify-between gap-3 px-1 pt-4">
                                                <div>
                                                      <h3 class="font-medium text-gray-900 group-hover:text-brand">{{ product.name }}</h3>
                                                      <div class="mt-2 flex gap-1.5" aria-label="Màu có sẵn">
                                                            <span
                                                                  v-for="color in product.colors"
                                                                  :key="color.code"
                                                                  class="size-3.5 rounded-full border border-black/10"
                                                                  :style="{ backgroundColor: color.hexCode }"
                                                                  :title="color.name"
                                                            />
                                                      </div>
                                                </div>
                                                <p class="shrink-0 text-sm font-semibold text-gray-900">
                                                      {{ formatVndFromJson(product.minPrice) }}
                                                </p>
                                          </div>
                                    </RouterLink>
                              </li>
                        </ul>

                        <nav v-if="totalPages > 1" class="mt-10 flex items-center justify-center gap-2 text-sm" aria-label="Phân trang">
                              <button
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded px-2 py-2 text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    :disabled="!hasPreviousPage"
                                    @click="goToPage(filters.page - 1)"
                              >
                                    <span aria-hidden="true" class="text-lg leading-none">‹</span> Trước
                              </button>
                              <button
                                    v-for="page in visiblePages"
                                    :key="page"
                                    type="button"
                                    class="size-8 rounded-full transition hover:bg-gray-100"
                                    :class="page === filters.page ? 'bg-gray-900 text-white hover:bg-gray-800' : 'text-gray-800'"
                                    :aria-current="page === filters.page ? 'page' : undefined"
                                    :aria-label="`Trang ${page}`"
                                    @click="goToPage(page)"
                              >
                                    {{ page }}
                              </button>
                              <button
                                    type="button"
                                    class="inline-flex items-center gap-1 rounded px-2 py-2 text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    :disabled="!hasNextPage"
                                    @click="goToPage(filters.page + 1)"
                              >
                                    Sau <span aria-hidden="true" class="text-lg leading-none">›</span>
                              </button>
                        </nav>
                  </QueryState>
            </div>
      </section>
</template>

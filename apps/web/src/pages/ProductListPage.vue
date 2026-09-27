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

function goToPage(page: number): void {
      void router.push({ query: { ...route.query, page: String(page) } });
}
</script>

<template>
      <section>
            <div class="overflow-hidden rounded-2xl bg-[#f4f0e8] px-6 py-10 sm:px-10 sm:py-14">
                  <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b5c3c]">ShopFlow · áo thun in sẵn</p>
                  <div class="mt-4 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
                        <div class="max-w-xl">
                              <h1 class="text-3xl font-semibold leading-tight tracking-tight text-brand sm:text-5xl">
                                    Mặc điều bạn yêu thích.
                              </h1>
                              <p class="mt-3 max-w-lg text-sm leading-6 text-gray-600 sm:text-base">
                                    Áo thun cotton với những thiết kế tối giản, chọn màu và size phù hợp với bạn.
                              </p>
                        </div>
                        <a
                              href="#catalog"
                              class="inline-flex items-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#263a63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                              Khám phá thiết kế <span class="ml-2" aria-hidden="true">↓</span>
                        </a>
                  </div>
            </div>

            <div id="catalog" class="mt-10 flex flex-col gap-2 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Bộ sưu tập</p>
                        <h2 class="mt-1 text-2xl font-semibold tracking-tight text-brand">Thiết kế dành cho bạn</h2>
                  </div>
                  <p v-if="meta" class="text-sm text-gray-500">{{ meta.total }} thiết kế</p>
            </div>

            <form class="mt-5 flex max-w-xl gap-2" role="search" @submit="searchProducts">
                  <label class="sr-only" for="product-search">Tìm thiết kế</label>
                  <input
                        id="product-search"
                        v-model="searchInput"
                        type="search"
                        name="q"
                        placeholder="Tìm theo tên thiết kế…"
                        class="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand"
                  />
                  <button
                        type="submit"
                        class="rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand transition hover:bg-brand hover:text-white"
                  >
                        Tìm kiếm
                  </button>
            </form>

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
                  <ul class="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                        <li v-for="product in items" :key="product.slug" class="group min-w-0">
                              <RouterLink
                                    :to="{ name: 'product-detail', params: { slug: product.slug } }"
                                    class="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                              >
                                    <div class="relative overflow-hidden rounded-xl bg-[#f3f0ea]">
                                          <img
                                                v-if="demoProductImage(product.slug)"
                                                :src="demoProductImage(product.slug)"
                                                :alt="'Ảnh minh họa ' + product.name"
                                                class="aspect-[4/4.5] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                                                loading="lazy"
                                          />
                                          <div
                                                v-else
                                                class="flex aspect-[4/4.5] items-center justify-center px-6 text-center text-sm text-gray-500"
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
                                    <div class="flex items-start justify-between gap-4 px-1 pt-4">
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
                                          <p class="shrink-0 text-sm font-semibold">{{ formatVndFromJson(product.minPrice) }}</p>
                                    </div>
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

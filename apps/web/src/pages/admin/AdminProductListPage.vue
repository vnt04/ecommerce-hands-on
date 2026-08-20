<script setup lang="ts">
import type { ProductStatus } from '@shopflow/shared';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { fetchAdminProducts } from '../../api/adminCatalog.js';
import QueryState from '../../components/QueryState.vue';

const route = useRoute();
const router = useRouter();

/** URL là nguồn duy nhất của bộ lọc, cùng cách đã làm ở màn hình đơn hàng. */
const filters = computed(() => ({
      status: (route.query.trang_thai as ProductStatus | undefined) ?? undefined,
      includeArchived: route.query.gom_luu_tru === '1',
      search: (route.query.tim as string | undefined) ?? undefined,
      page: Number(route.query.trang ?? 1),
}));

const query = useQuery({
      queryKey: computed(() => ['admin-products', filters.value]),
      queryFn: () => fetchAdminProducts(filters.value),
});

const products = computed(() => query.data.value?.items ?? []);
const meta = computed(() => query.data.value?.meta);

const totalPages = computed(() => (meta.value === undefined ? 1 : Math.max(1, Math.ceil(meta.value.total / meta.value.limit))));

const STATUS_LABELS: Record<ProductStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đang bán' };

const STATUS_TABS: Array<{ value: ProductStatus | undefined; label: string }> = [
      { value: undefined, label: 'Tất cả' },
      { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
      { value: 'PUBLISHED', label: STATUS_LABELS.PUBLISHED },
];

function applyFilter(change: Record<string, string | undefined>): void {
      void router.push({ query: { ...route.query, ...change, trang: undefined } });
}

function goToPage(page: number): void {
      void router.push({ query: { ...route.query, trang: page === 1 ? undefined : String(page) } });
}
</script>

<template>
      <section>
            <div class="flex flex-wrap items-center justify-between gap-4">
                  <h1 class="text-2xl font-bold text-brand">Thiết kế</h1>
                  <RouterLink to="/quan-tri/thiet-ke/tao-moi" class="rounded bg-brand px-4 py-2 text-sm font-semibold text-white">
                        Tạo thiết kế
                  </RouterLink>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
                  <button
                        v-for="tab in STATUS_TABS"
                        :key="tab.label"
                        type="button"
                        class="rounded border px-3 py-1.5 text-sm"
                        :class="filters.status === tab.value ? 'border-brand bg-brand text-white' : 'border-gray-300'"
                        :aria-pressed="filters.status === tab.value"
                        @click="applyFilter({ trang_thai: tab.value })"
                  >
                        {{ tab.label }}
                  </button>

                  <label class="ml-2 flex items-center gap-2 text-sm text-gray-600">
                        <input
                              type="checkbox"
                              :checked="filters.includeArchived"
                              @change="applyFilter({ gom_luu_tru: ($event.target as HTMLInputElement).checked ? '1' : undefined })"
                        />
                        Gồm cả đã lưu trữ
                  </label>
            </div>

            <label class="mt-4 block">
                  <span class="sr-only">Tìm theo tên hoặc mã thiết kế</span>
                  <input
                        type="search"
                        :value="filters.search"
                        placeholder="Tên hoặc mã thiết kế"
                        class="w-full rounded border border-gray-300 px-3 py-2"
                        @change="applyFilter({ tim: ($event.target as HTMLInputElement).value || undefined })"
                  />
            </label>

            <QueryState
                  class="mt-6"
                  :is-pending="query.isPending.value"
                  :error="query.error.value"
                  :is-empty="products.length === 0"
                  empty-message="Không có thiết kế nào khớp bộ lọc"
            >
                  <div class="mt-6 overflow-x-auto">
                        <table class="w-full min-w-3xl border-collapse text-sm">
                              <thead>
                                    <tr class="border-b border-gray-300 text-left">
                                          <th class="py-2 pr-4">Mã thiết kế</th>
                                          <th class="py-2 pr-4">Tên</th>
                                          <th class="py-2 pr-4">Trạng thái</th>
                                          <th class="py-2 pr-4 text-right">Tổ hợp</th>
                                          <th class="py-2 pr-4 text-right">Tổng tồn</th>
                                    </tr>
                              </thead>
                              <tbody>
                                    <tr v-for="product in products" :key="product.slug" class="border-b border-gray-200">
                                          <td class="py-2 pr-4 font-mono text-xs">{{ product.designCode }}</td>
                                          <td class="py-2 pr-4">
                                                <RouterLink
                                                      :to="'/quan-tri/thiet-ke/' + product.slug"
                                                      class="font-semibold hover:underline"
                                                >
                                                      {{ product.name }}
                                                </RouterLink>
                                          </td>
                                          <td class="py-2 pr-4">
                                                <span
                                                      class="rounded-full px-2 py-1 text-xs font-semibold"
                                                      :class="
                                                            product.status === 'PUBLISHED'
                                                                  ? 'bg-green-100 text-green-900'
                                                                  : 'bg-gray-200 text-gray-700'
                                                      "
                                                >
                                                      {{ STATUS_LABELS[product.status] }}
                                                </span>
                                                <span v-if="product.isArchived" class="ml-2 text-xs text-gray-500">Đã lưu trữ</span>
                                          </td>
                                          <td class="py-2 pr-4 text-right">{{ product.activeVariantCount }}/{{ product.variantCount }}</td>
                                          <!--
                                                Tô đỏ khi kho cạn để nhìn danh sách là thấy ngay cái nào
                                                cần nhập thêm, không phải mở từng thiết kế ra đếm.
                                          -->
                                          <td
                                                class="py-2 pr-4 text-right font-semibold"
                                                :class="product.totalStock === 0 ? 'text-red-600' : ''"
                                          >
                                                {{ product.totalStock }}
                                          </td>
                                    </tr>
                              </tbody>
                        </table>
                  </div>

                  <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-4 text-sm">
                        <button
                              type="button"
                              class="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40"
                              :disabled="filters.page <= 1"
                              @click="goToPage(filters.page - 1)"
                        >
                              Trang trước
                        </button>
                        <span class="text-gray-600">Trang {{ filters.page }} trên {{ totalPages }}</span>
                        <button
                              type="button"
                              class="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-40"
                              :disabled="filters.page >= totalPages"
                              @click="goToPage(filters.page + 1)"
                        >
                              Trang sau
                        </button>
                  </div>
            </QueryState>
      </section>
</template>

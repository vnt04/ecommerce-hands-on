<script setup lang="ts">
import { formatVndFromJson, type OrderStatus } from '@shopflow/shared';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { fetchAdminOrders } from '../../api/orders.js';
import QueryState from '../../components/QueryState.vue';
import { formatDate, ORDER_STATUS_CLASSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../../composables/orderStatus.js';

const route = useRoute();
const router = useRouter();

/**
 * URL là nguồn duy nhất của bộ lọc.
 *
 * Giữ thêm một bản sao trong component nghĩa là hai nguồn sự thật, và tải lại
 * trang hoặc bấm nút quay lại sẽ hiện một tập đơn khác với thứ trên thanh địa chỉ.
 */
const filters = computed(() => ({
      status: (route.query.trang_thai as OrderStatus | undefined) ?? undefined,
      search: (route.query.tim as string | undefined) ?? undefined,
      from: (route.query.tu as string | undefined) ?? undefined,
      to: (route.query.den as string | undefined) ?? undefined,
      page: Number(route.query.trang ?? 1),
}));

const query = useQuery({
      queryKey: computed(() => ['admin-orders', filters.value]),
      queryFn: () => fetchAdminOrders(filters.value),
});

const orders = computed(() => query.data.value?.items ?? []);
const meta = computed(() => query.data.value?.meta);

const totalPages = computed(() => (meta.value === undefined ? 1 : Math.max(1, Math.ceil(meta.value.total / meta.value.limit))));

const STATUS_TABS: Array<{ value: OrderStatus | undefined; label: string }> = [
      { value: undefined, label: 'Tất cả' },
      { value: 'PENDING', label: ORDER_STATUS_LABELS.PENDING },
      { value: 'CONFIRMED', label: ORDER_STATUS_LABELS.CONFIRMED },
      { value: 'SHIPPING', label: ORDER_STATUS_LABELS.SHIPPING },
      { value: 'DELIVERED', label: ORDER_STATUS_LABELS.DELIVERED },
      { value: 'CANCELLED', label: ORDER_STATUS_LABELS.CANCELLED },
];

/** Đổi bộ lọc là đổi URL. Đổi bộ lọc luôn quay về trang một. */
function applyFilter(change: Record<string, string | undefined>): void {
      void router.push({ query: { ...route.query, ...change, trang: undefined } });
}

function goToPage(page: number): void {
      void router.push({ query: { ...route.query, trang: page === 1 ? undefined : String(page) } });
}
</script>

<template>
      <section>
            <h1 class="text-2xl font-bold text-brand">Đơn hàng</h1>

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
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
                  <label class="grow">
                        <span class="sr-only">Tìm theo mã đơn hoặc số điện thoại</span>
                        <input
                              type="search"
                              :value="filters.search"
                              placeholder="Mã đơn hoặc số điện thoại"
                              class="w-full rounded border border-gray-300 px-3 py-2"
                              @change="applyFilter({ tim: ($event.target as HTMLInputElement).value || undefined })"
                        />
                  </label>

                  <label class="text-sm">
                        <span class="mr-2 text-gray-600">Từ</span>
                        <input
                              type="date"
                              :value="filters.from"
                              class="rounded border border-gray-300 px-2 py-2"
                              @change="applyFilter({ tu: ($event.target as HTMLInputElement).value || undefined })"
                        />
                  </label>

                  <label class="text-sm">
                        <span class="mr-2 text-gray-600">Đến</span>
                        <input
                              type="date"
                              :value="filters.to"
                              class="rounded border border-gray-300 px-2 py-2"
                              @change="applyFilter({ den: ($event.target as HTMLInputElement).value || undefined })"
                        />
                  </label>
            </div>

            <QueryState
                  class="mt-6"
                  :is-pending="query.isPending.value"
                  :error="query.error.value"
                  :is-empty="orders.length === 0"
                  empty-message="Không có đơn nào khớp bộ lọc"
            >
                  <div class="mt-6 overflow-x-auto">
                        <table class="w-full min-w-3xl border-collapse text-sm">
                              <thead>
                                    <tr class="border-b border-gray-300 text-left">
                                          <th class="py-2 pr-4">Mã đơn</th>
                                          <th class="py-2 pr-4">Ngày đặt</th>
                                          <th class="py-2 pr-4">Người nhận</th>
                                          <th class="py-2 pr-4">Trạng thái</th>
                                          <th class="py-2 pr-4">Thanh toán</th>
                                          <th class="py-2 pr-4 text-right">Tổng tiền</th>
                                    </tr>
                              </thead>
                              <tbody>
                                    <tr v-for="order in orders" :key="order.orderNumber" class="border-b border-gray-200">
                                          <td class="py-2 pr-4">
                                                <RouterLink
                                                      :to="'/quan-tri/don-hang/' + order.orderNumber"
                                                      class="font-semibold hover:underline"
                                                >
                                                      {{ order.orderNumber }}
                                                </RouterLink>
                                          </td>
                                          <td class="py-2 pr-4 text-gray-600">{{ formatDate(order.placedAt) }}</td>
                                          <td class="py-2 pr-4">
                                                {{ order.recipientName }}
                                                <span class="block text-gray-500">{{ order.recipientPhone }} · {{ order.province }}</span>
                                          </td>
                                          <td class="py-2 pr-4">
                                                <span
                                                      class="rounded-full px-2 py-1 text-xs font-semibold"
                                                      :class="ORDER_STATUS_CLASSES[order.status]"
                                                >
                                                      {{ ORDER_STATUS_LABELS[order.status] }}
                                                </span>
                                          </td>
                                          <td class="py-2 pr-4 text-gray-600">{{ PAYMENT_STATUS_LABELS[order.paymentStatus] }}</td>
                                          <td class="py-2 pr-4 text-right font-semibold">{{ formatVndFromJson(order.total) }}</td>
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

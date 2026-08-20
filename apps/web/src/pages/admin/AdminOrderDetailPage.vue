<script setup lang="ts">
import { formatVndFromJson, type OrderHistoryEntry, type OrderStatus } from '@shopflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';

import { ApiError } from '../../api/client.js';
import { fetchAdminOrder, updateAdminOrder } from '../../api/orders.js';
import QueryState from '../../components/QueryState.vue';
import {
      formatDateTime,
      ORDER_STATUS_CLASSES,
      ORDER_STATUS_LABELS,
      PAYMENT_STATUS_LABELS,
      TRANSITION_LABELS,
} from '../../composables/orderStatus.js';

const props = defineProps<{ orderNumber: string }>();

const queryClient = useQueryClient();
const note = ref('');
const actionError = ref<string | undefined>(undefined);

const queryKey = computed(() => ['admin-order', props.orderNumber]);

const query = useQuery({
      queryKey,
      queryFn: () => fetchAdminOrder(props.orderNumber),
});

const order = computed(() => query.data.value);

const mutation = useMutation({
      mutationFn: (change: Parameters<typeof updateAdminOrder>[1]) => updateAdminOrder(props.orderNumber, change),
      onSuccess: (updated) => {
            queryClient.setQueryData(queryKey.value, updated);
            // Danh sách đang mở ở tab khác phải lấy lại; trạng thái vừa đổi.
            void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
            note.value = '';
            actionError.value = undefined;
      },
      onError: (error: unknown) => {
            actionError.value = error instanceof ApiError ? error.message : 'Không thực hiện được thao tác';
      },
});

function changeStatus(status: OrderStatus): void {
      mutation.mutate({ status, note: note.value || undefined });
}

function markPaid(): void {
      mutation.mutate({ paymentStatus: 'PAID', note: note.value || undefined });
}

/**
 * Nhãn của một dòng lịch sử, dựng trong một biểu thức duy nhất.
 *
 * Ghép bằng hai chỗ nội suy cạnh nhau trong template thì trình biên dịch chèn
 * khoảng trắng vào giữa, và chuỗi hiển thị không còn là thứ ta viết ra.
 */
function describeEntry(entry: OrderHistoryEntry): string {
      if (entry.kind === 'STATUS') {
            const to = ORDER_STATUS_LABELS[entry.to];

            return entry.from === null ? to : ORDER_STATUS_LABELS[entry.from] + ' → ' + to;
      }

      const to = PAYMENT_STATUS_LABELS[entry.to];

      return entry.from === null ? to : PAYMENT_STATUS_LABELS[entry.from] + ' → ' + to;
}

/** Huỷ đơn là thao tác không lùi lại được, nên hỏi lại trước khi gửi. */
function confirmCancel(): void {
      if (window.confirm('Huỷ đơn này? Hàng sẽ được cộng trả về kho.')) {
            changeStatus('CANCELLED');
      }
}
</script>

<template>
      <QueryState :is-pending="query.isPending.value" :error="query.error.value" :is-empty="false">
            <article v-if="order">
                  <RouterLink to="/quan-tri/don-hang" class="text-sm text-gray-500 hover:underline">← Tất cả đơn hàng</RouterLink>

                  <div class="mt-2 flex flex-wrap items-center gap-3">
                        <h1 class="text-2xl font-bold text-brand">{{ order.orderNumber }}</h1>
                        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="ORDER_STATUS_CLASSES[order.status]">
                              {{ ORDER_STATUS_LABELS[order.status] }}
                        </span>
                        <span class="text-sm text-gray-600">{{ PAYMENT_STATUS_LABELS[order.paymentStatus] }}</span>
                  </div>

                  <p class="mt-1 text-sm text-gray-500">Đặt lúc {{ formatDateTime(order.placedAt) }}</p>

                  <section class="mt-6 rounded border border-gray-200 p-4">
                        <h2 class="font-semibold">Thao tác</h2>

                        <label class="mt-3 block text-sm">
                              <span class="text-gray-600">Ghi chú <span class="text-gray-400">(không bắt buộc)</span></span>
                              <input
                                    v-model="note"
                                    type="text"
                                    placeholder="Lý do, hoặc thông tin trao đổi với khách"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                              />
                        </label>

                        <div class="mt-3 flex flex-wrap gap-2">
                              <!--
                                    Chỉ hiện những bước chuyển máy chủ nói là hợp lệ. Hiện hết rồi
                                    để máy chủ từ chối là dạy người dùng bỏ qua thông báo lỗi.
                              -->
                              <button
                                    v-for="target in order.allowedTransitions"
                                    :key="target"
                                    type="button"
                                    class="rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    :class="target === 'CANCELLED' ? 'bg-red-600' : 'bg-brand'"
                                    :disabled="mutation.isPending.value"
                                    @click="target === 'CANCELLED' ? confirmCancel() : changeStatus(target)"
                              >
                                    {{ TRANSITION_LABELS[target] }}
                              </button>

                              <button
                                    v-if="order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED'"
                                    type="button"
                                    class="rounded border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                                    :disabled="mutation.isPending.value"
                                    @click="markPaid()"
                              >
                                    Đánh dấu đã thu tiền
                              </button>
                        </div>

                        <p v-if="order.allowedTransitions.length === 0" class="mt-3 text-sm text-gray-500">
                              Đơn đã ở trạng thái cuối, không chuyển tiếp được.
                        </p>

                        <p v-if="actionError" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
                              {{ actionError }}
                        </p>
                  </section>

                  <ul class="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                        <li v-for="line in order.lines" :key="line.sku" class="flex flex-wrap items-center gap-4 py-4">
                              <div class="min-w-48 grow">
                                    <p class="font-semibold">{{ line.productName }}</p>
                                    <p class="text-sm text-gray-500">{{ line.colorName }} · Size {{ line.sizeName }} · {{ line.sku }}</p>
                              </div>
                              <p class="text-sm text-gray-600">{{ formatVndFromJson(line.unitPrice) }} × {{ line.quantity }}</p>
                              <p class="w-32 text-right font-semibold">{{ formatVndFromJson(line.lineTotal) }}</p>
                        </li>
                  </ul>

                  <div class="mt-4 flex justify-between text-lg font-bold">
                        <span>Tổng cộng</span>
                        <span>{{ formatVndFromJson(order.total) }}</span>
                  </div>

                  <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <section class="rounded border border-gray-200 p-4 text-sm">
                              <h2 class="font-semibold">Giao tới</h2>
                              <p class="mt-2">{{ order.shipping.recipientName }} · {{ order.shipping.recipientPhone }}</p>
                              <p class="text-gray-600">
                                    {{ order.shipping.addressLine }}, {{ order.shipping.ward }}, {{ order.shipping.district }},
                                    {{ order.shipping.province }}
                              </p>
                              <p v-if="order.shipping.note" class="mt-2 text-gray-600">Ghi chú: {{ order.shipping.note }}</p>
                        </section>

                        <section class="rounded border border-gray-200 p-4 text-sm">
                              <h2 class="font-semibold">Lịch sử</h2>

                              <ol class="mt-3 space-y-3">
                                    <li v-for="(entry, index) in order.history" :key="index" class="border-l-2 border-gray-200 pl-3">
                                          <p>{{ describeEntry(entry) }}</p>
                                          <p class="text-gray-500">{{ formatDateTime(entry.at) }} · {{ entry.changedBy ?? 'Hệ thống' }}</p>
                                          <p v-if="entry.note" class="text-gray-600">{{ entry.note }}</p>
                                    </li>
                              </ol>

                              <p v-if="order.history.length === 0" class="mt-3 text-gray-500">Chưa có thay đổi nào.</p>
                        </section>
                  </div>
            </article>
      </QueryState>
</template>

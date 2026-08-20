<script setup lang="ts">
import { formatVndFromJson } from '@shopflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError } from '../api/client.js';
import { cancelOrder, fetchOrder } from '../api/orders.js';
import QueryState from '../components/QueryState.vue';
import { formatDateTime, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../composables/orderStatus.js';

const props = defineProps<{ orderNumber: string }>();

const route = useRoute();

/** Vừa đặt xong thì trang này đóng vai trang xác nhận, không phải trang tra cứu. */
const isJustPlaced = computed(() => route.query.vua_dat === '1');

const query = useQuery({
      queryKey: computed(() => ['order', props.orderNumber]),
      queryFn: () => fetchOrder(props.orderNumber),
});

const order = computed(() => query.data.value);

const queryClient = useQueryClient();
const cancelError = ref<string | undefined>(undefined);

/** Khách chỉ huỷ được khi máy chủ nói là được. Giao diện không tự suy luật đó. */
const canCancel = computed(() => order.value?.allowedTransitions.includes('CANCELLED') === true);

const cancelMutation = useMutation({
      mutationFn: () => cancelOrder(props.orderNumber),
      onSuccess: (updated) => {
            queryClient.setQueryData(['order', props.orderNumber], updated);
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            cancelError.value = undefined;
      },
      onError: (error: unknown) => {
            cancelError.value = error instanceof ApiError ? error.message : 'Không huỷ được đơn, vui lòng thử lại';
      },
});

/** Huỷ đơn không lùi lại được, nên hỏi lại trước khi gửi. */
function confirmCancel(): void {
      if (window.confirm('Huỷ đơn này? Thao tác không thể hoàn tác.')) {
            cancelMutation.mutate();
      }
}
</script>

<template>
      <QueryState :is-pending="query.isPending.value" :error="query.error.value" :is-empty="false">
            <article v-if="order">
                  <p v-if="isJustPlaced" class="rounded bg-green-50 p-4 text-green-800" role="status">
                        <span class="font-semibold">Đặt hàng thành công.</span>
                        Đơn của bạn đang chờ xác nhận. Shop sẽ gọi lại theo số điện thoại bạn để lại.
                  </p>

                  <h1 class="mt-4 text-2xl font-bold text-brand">Đơn {{ order.orderNumber }}</h1>
                  <p class="mt-1 text-sm text-gray-500">
                        Đặt lúc {{ formatDateTime(order.placedAt) }} · {{ ORDER_STATUS_LABELS[order.status] }} ·
                        {{ order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng' : 'Thanh toán trực tuyến' }}
                  </p>

                  <ul class="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                        <li v-for="line in order.lines" :key="line.sku" class="flex flex-wrap items-center gap-4 py-4">
                              <div class="min-w-48 grow">
                                    <RouterLink :to="'/san-pham/' + line.productSlug" class="font-semibold hover:underline">
                                          {{ line.productName }}
                                    </RouterLink>
                                    <p class="text-sm text-gray-500">{{ line.colorName }} · Size {{ line.sizeName }}</p>
                              </div>

                              <p class="text-sm text-gray-600">{{ formatVndFromJson(line.unitPrice) }} × {{ line.quantity }}</p>
                              <p class="w-32 text-right font-semibold">{{ formatVndFromJson(line.lineTotal) }}</p>
                        </li>
                  </ul>

                  <dl class="mt-4 space-y-1 text-sm">
                        <div class="flex justify-between">
                              <dt class="text-gray-600">Tạm tính</dt>
                              <dd>{{ formatVndFromJson(order.subtotal) }}</dd>
                        </div>
                        <div class="flex justify-between">
                              <dt class="text-gray-600">Phí vận chuyển</dt>
                              <dd>{{ order.shippingFee === '0' ? 'Miễn phí' : formatVndFromJson(order.shippingFee) }}</dd>
                        </div>
                        <div class="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
                              <dt>Tổng cộng</dt>
                              <dd>{{ formatVndFromJson(order.total) }}</dd>
                        </div>
                  </dl>

                  <section class="mt-8 rounded border border-gray-200 p-4 text-sm">
                        <h2 class="font-semibold">Giao tới</h2>
                        <p class="mt-2">{{ order.shipping.recipientName }} · {{ order.shipping.recipientPhone }}</p>
                        <p class="text-gray-600">
                              {{ order.shipping.addressLine }}, {{ order.shipping.ward }}, {{ order.shipping.district }},
                              {{ order.shipping.province }}
                        </p>
                        <p v-if="order.shipping.note" class="mt-2 text-gray-600">Ghi chú: {{ order.shipping.note }}</p>
                  </section>

                  <section v-if="order.history.length > 0" class="mt-6 rounded border border-gray-200 p-4 text-sm">
                        <h2 class="font-semibold">Lịch sử đơn</h2>

                        <ol class="mt-3 space-y-2">
                              <li v-for="(entry, index) in order.history" :key="index">
                                    <span v-if="entry.kind === 'STATUS'">{{ ORDER_STATUS_LABELS[entry.to] }}</span>
                                    <span v-else>{{ PAYMENT_STATUS_LABELS[entry.to] }}</span>
                                    <span class="text-gray-500"> · {{ formatDateTime(entry.at) }}</span>
                              </li>
                        </ol>
                  </section>

                  <div class="mt-6 flex flex-wrap items-center justify-between gap-4">
                        <RouterLink to="/don-hang" class="text-sm text-gray-500 hover:underline">← Tất cả đơn hàng</RouterLink>

                        <button
                              v-if="canCancel"
                              type="button"
                              class="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                              :disabled="cancelMutation.isPending.value"
                              @click="confirmCancel()"
                        >
                              {{ cancelMutation.isPending.value ? 'Đang huỷ…' : 'Huỷ đơn' }}
                        </button>
                  </div>

                  <p v-if="cancelError" class="mt-3 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{{ cancelError }}</p>
            </article>
      </QueryState>
</template>

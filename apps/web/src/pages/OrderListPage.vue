<script setup lang="ts">
import { formatVndFromJson, type OrderStatus } from '@shopflow/shared';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';

import { fetchOrders } from '../api/orders.js';
import QueryState from '../components/QueryState.vue';

const query = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });

const orders = computed(() => query.data.value ?? []);

const STATUS_LABELS: Record<OrderStatus, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      SHIPPING: 'Đang giao',
      DELIVERED: 'Đã giao',
      CANCELLED: 'Đã huỷ',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
      PENDING: 'bg-amber-100 text-amber-900',
      CONFIRMED: 'bg-blue-100 text-blue-900',
      SHIPPING: 'bg-blue-100 text-blue-900',
      DELIVERED: 'bg-green-100 text-green-900',
      CANCELLED: 'bg-gray-200 text-gray-700',
};

function formatPlacedAt(value: string): string {
      return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}
</script>

<template>
      <QueryState
            :is-pending="query.isPending.value"
            :error="query.error.value"
            :is-empty="orders.length === 0"
            empty-message="Bạn chưa đặt đơn nào"
      >
            <h1 class="text-2xl font-bold text-brand">Đơn hàng của bạn</h1>

            <ul class="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                  <li v-for="order in orders" :key="order.orderNumber" class="flex flex-wrap items-center gap-4 py-4">
                        <div class="min-w-48 grow">
                              <RouterLink :to="'/don-hang/' + order.orderNumber" class="font-semibold hover:underline">
                                    {{ order.orderNumber }}
                              </RouterLink>
                              <p class="text-sm text-gray-500">{{ formatPlacedAt(order.placedAt) }} · {{ order.itemCount }} sản phẩm</p>
                        </div>

                        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="STATUS_CLASSES[order.status]">
                              {{ STATUS_LABELS[order.status] }}
                        </span>

                        <p class="w-32 text-right font-semibold">{{ formatVndFromJson(order.total) }}</p>
                  </li>
            </ul>
      </QueryState>
</template>

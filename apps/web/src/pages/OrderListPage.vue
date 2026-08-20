<script setup lang="ts">
import { formatVndFromJson } from '@shopflow/shared';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';

import { fetchOrders } from '../api/orders.js';
import QueryState from '../components/QueryState.vue';
import { formatDate, ORDER_STATUS_CLASSES, ORDER_STATUS_LABELS } from '../composables/orderStatus.js';

const query = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });

const orders = computed(() => query.data.value ?? []);
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
                              <p class="text-sm text-gray-500">{{ formatDate(order.placedAt) }} · {{ order.itemCount }} sản phẩm</p>
                        </div>

                        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="ORDER_STATUS_CLASSES[order.status]">
                              {{ ORDER_STATUS_LABELS[order.status] }}
                        </span>

                        <p class="w-32 text-right font-semibold">{{ formatVndFromJson(order.total) }}</p>
                  </li>
            </ul>
      </QueryState>
</template>

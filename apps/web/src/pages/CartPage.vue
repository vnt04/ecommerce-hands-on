<script setup lang="ts">
import { formatVndFromJson } from '@shopflow/shared';
import { computed } from 'vue';

import QueryState from '../components/QueryState.vue';
import { useCart } from '../composables/useCart.js';

const { cart, isPending, error, notice, isMutating, updateQuantity, removeItem, dismissNotice } = useCart();

/**
 * Chỉ dòng hết hàng mới chặn đặt hàng.
 *
 * Giá đổi là thông tin, không phải lỗi: giỏ luôn hiện giá hiện tại nên số khách
 * nhìn thấy đúng là số sẽ trả, chỉ cần cho biết nó đã khác lúc thêm vào giỏ.
 */
const hasBlockingLine = computed(() => cart.value.lines.some((line) => line.isOutOfStock));

/** Số lượng chọn được cho một dòng: từ 1 tới số còn trong kho. */
function quantityOptions(availableQuantity: number): number[] {
      return Array.from({ length: availableQuantity }, (_, index) => index + 1);
}
</script>

<template>
      <QueryState :is-pending="isPending" :error="error" :is-empty="cart.lines.length === 0" empty-message="Giỏ hàng đang trống">
            <h1 class="text-2xl font-bold text-brand">Giỏ hàng</h1>

            <p v-if="notice" class="mt-4 flex items-start justify-between gap-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
                  <span>{{ notice }}</span>
                  <button type="button" class="shrink-0 underline" @click="dismissNotice()">Đã hiểu</button>
            </p>

            <ul class="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                  <li v-for="line in cart.lines" :key="line.sku" class="flex flex-wrap items-center gap-4 py-4">
                        <div class="min-w-48 grow">
                              <RouterLink :to="'/san-pham/' + line.productSlug" class="font-semibold hover:underline">
                                    {{ line.productName }}
                              </RouterLink>
                              <p class="text-sm text-gray-500">{{ line.colorName }} · Size {{ line.sizeName }}</p>

                              <!--
                                    Hai cảnh báo dưới đây phải hiện ngay trên dòng, không gom về
                                    một chỗ: khách cần biết dòng nào có vấn đề, không phải là giỏ
                                    có vấn đề ở đâu đó.
                              -->
                              <p v-if="line.isOutOfStock" class="mt-1 text-sm font-medium text-red-600">
                                    Đã hết hàng. Xoá dòng này để tiếp tục đặt hàng.
                              </p>
                              <p v-else-if="line.hasPriceChanged" class="mt-1 text-sm text-amber-700">
                                    Giá đã thay đổi kể từ lúc bạn thêm vào giỏ.
                              </p>
                        </div>

                        <label class="flex items-center gap-2 text-sm">
                              <span class="sr-only">Số lượng {{ line.productName }} size {{ line.sizeName }}</span>
                              <select
                                    class="rounded border border-gray-300 px-2 py-1"
                                    :value="line.quantity"
                                    :disabled="isMutating || line.isOutOfStock"
                                    @change="updateQuantity(line.sku, Number(($event.target as HTMLSelectElement).value))"
                              >
                                    <option v-for="value in quantityOptions(line.availableQuantity)" :key="value" :value="value">
                                          {{ value }}
                                    </option>
                              </select>
                        </label>

                        <p class="w-32 text-right font-semibold">{{ formatVndFromJson(line.lineTotal) }}</p>

                        <button
                              type="button"
                              class="text-sm text-gray-500 hover:text-red-600 hover:underline"
                              :disabled="isMutating"
                              @click="removeItem(line.sku)"
                        >
                              Xoá
                        </button>
                  </li>
            </ul>

            <div class="mt-6 flex items-center justify-between">
                  <span class="text-gray-600">Tạm tính ({{ cart.itemCount }} sản phẩm)</span>
                  <span class="text-xl font-bold">{{ formatVndFromJson(cart.subtotal) }}</span>
            </div>

            <p class="mt-1 text-right text-sm text-gray-500">Phí vận chuyển tính ở bước đặt hàng.</p>

            <!--
                  Nút đặt hàng chỉ mở khi không còn dòng hết hàng. Cho đi tiếp rồi để
                  bước đặt hàng từ chối là bắt khách nhập lại địa chỉ cho một đơn không
                  thể thành công.
            -->
            <RouterLink
                  :to="hasBlockingLine ? '' : '/thanh-toan'"
                  class="mt-6 block w-full rounded py-3 text-center font-semibold text-white"
                  :class="hasBlockingLine ? 'pointer-events-none bg-gray-300' : 'bg-brand'"
                  :aria-disabled="hasBlockingLine"
            >
                  Đặt hàng
            </RouterLink>
            <p v-if="hasBlockingLine" class="mt-2 text-center text-sm text-gray-500">Xoá các dòng đã hết hàng để tiếp tục.</p>
      </QueryState>
</template>

<script setup lang="ts">
import { formatVndFromJson, type OrderConflictDetail, type ShippingInfo } from '@shopflow/shared';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ApiError } from '../api/client.js';
import { newIdempotencyKey, placeOrder } from '../api/orders.js';
import QueryState from '../components/QueryState.vue';
import { useCart } from '../composables/useCart.js';

const router = useRouter();
const { cart, isPending, error } = useCart();

const form = ref<ShippingInfo>({
      recipientName: '',
      recipientPhone: '',
      addressLine: '',
      ward: '',
      district: '',
      province: '',
      note: '',
});

/**
 * Khoá chống trùng sinh một lần cho màn hình này và giữ nguyên qua mọi lần bấm lại.
 *
 * Sinh lại ở mỗi lần gửi thì chốt chặn của máy chủ trở nên vô nghĩa: hai lần bấm
 * mang hai khoá khác nhau là hai đơn khác nhau (ràng buộc R3).
 */
const idempotencyKey = ref(newIdempotencyKey());

const isSubmitting = ref(false);
const submitError = ref<string | undefined>(undefined);
const invalidFields = ref<string[]>([]);

/** SKU của dòng làm đơn không đặt được, để đánh dấu đúng dòng đó. */
const blockedSku = ref<string | undefined>(undefined);

const hasOutOfStockLine = computed(() => cart.value.lines.some((line) => line.isOutOfStock));

const VIETNAM_MOBILE = /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/;

/** Kiểm tại chỗ trước khi gửi. Máy chủ vẫn kiểm lại — đây chỉ là để khách biết sớm. */
function validate(): boolean {
      const invalid: string[] = [];
      const value = form.value;

      if (value.recipientName.trim().length < 2) {
            invalid.push('recipientName');
      }

      if (!VIETNAM_MOBILE.test(value.recipientPhone.replace(/[\s.-]/g, ''))) {
            invalid.push('recipientPhone');
      }

      if (value.addressLine.trim().length < 5) {
            invalid.push('addressLine');
      }

      for (const field of ['ward', 'district', 'province'] as const) {
            if (value[field].trim() === '') {
                  invalid.push(field);
            }
      }

      invalidFields.value = invalid;

      return invalid.length === 0;
}

const FIELD_MESSAGES: Record<string, string> = {
      recipientName: 'Nhập tên người nhận',
      recipientPhone: 'Số điện thoại di động không hợp lệ',
      addressLine: 'Nhập số nhà và tên đường',
      ward: 'Nhập phường xã',
      district: 'Nhập quận huyện',
      province: 'Nhập tỉnh thành',
};

function messageFor(field: string): string | undefined {
      return invalidFields.value.includes(field) ? FIELD_MESSAGES[field] : undefined;
}

function describeConflict(detail: OrderConflictDetail): string {
      if (detail.reason === 'OUT_OF_STOCK') {
            return detail.availableQuantity === 0
                  ? 'Một sản phẩm trong giỏ vừa hết hàng. Xoá dòng được đánh dấu rồi đặt lại.'
                  : 'Kho chỉ còn ' + detail.availableQuantity + ' sản phẩm. Giảm số lượng dòng được đánh dấu rồi đặt lại.';
      }

      if (detail.reason === 'NOT_SELLABLE') {
            return 'Một sản phẩm trong giỏ đã ngừng bán. Xoá dòng được đánh dấu rồi đặt lại.';
      }

      if (detail.reason === 'CART_EMPTY') {
            return 'Giỏ hàng đang trống.';
      }

      return 'Đơn hàng đang được xử lý. Chờ vài giây rồi thử lại.';
}

async function submit(): Promise<void> {
      submitError.value = undefined;
      blockedSku.value = undefined;

      if (!validate() || isSubmitting.value) {
            return;
      }

      isSubmitting.value = true;

      try {
            const order = await placeOrder({ ...form.value, note: form.value.note || undefined }, idempotencyKey.value);

            await router.push({ name: 'order-detail', params: { orderNumber: order.orderNumber }, query: { vua_dat: '1' } });
      } catch (caught: unknown) {
            if (!(caught instanceof ApiError)) {
                  throw caught;
            }

            if (caught.code === 'VALIDATION_FAILED') {
                  const detail = caught.details as { fields?: string[] } | undefined;
                  invalidFields.value = detail?.fields ?? [];
                  submitError.value = 'Kiểm tra lại các ô được đánh dấu.';
            } else if (caught.code === 'CONFLICT') {
                  const detail = caught.details as OrderConflictDetail | undefined;
                  blockedSku.value = detail?.sku;
                  submitError.value = detail === undefined ? caught.message : describeConflict(detail);
            } else {
                  submitError.value = caught.message;
            }
      } finally {
            isSubmitting.value = false;
      }
}
</script>

<template>
      <QueryState :is-pending="isPending" :error="error" :is-empty="cart.lines.length === 0" empty-message="Giỏ hàng đang trống">
            <h1 class="text-2xl font-bold text-brand">Thông tin giao hàng</h1>

            <div class="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr]">
                  <form novalidate @submit.prevent="submit()">
                        <label class="block">
                              <span class="text-sm font-semibold text-gray-700">Người nhận</span>
                              <input
                                    v-model="form.recipientName"
                                    type="text"
                                    autocomplete="name"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    :aria-invalid="invalidFields.includes('recipientName')"
                              />
                              <span v-if="messageFor('recipientName')" class="text-sm text-red-600">
                                    {{ messageFor('recipientName') }}
                              </span>
                        </label>

                        <label class="mt-4 block">
                              <span class="text-sm font-semibold text-gray-700">Số điện thoại</span>
                              <input
                                    v-model="form.recipientPhone"
                                    type="tel"
                                    autocomplete="tel"
                                    inputmode="tel"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    :aria-invalid="invalidFields.includes('recipientPhone')"
                              />
                              <span v-if="messageFor('recipientPhone')" class="text-sm text-red-600">
                                    {{ messageFor('recipientPhone') }}
                              </span>
                        </label>

                        <label class="mt-4 block">
                              <span class="text-sm font-semibold text-gray-700">Số nhà và tên đường</span>
                              <input
                                    v-model="form.addressLine"
                                    type="text"
                                    autocomplete="street-address"
                                    class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                    :aria-invalid="invalidFields.includes('addressLine')"
                              />
                              <span v-if="messageFor('addressLine')" class="text-sm text-red-600">
                                    {{ messageFor('addressLine') }}
                              </span>
                        </label>

                        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <label v-for="field in ['ward', 'district', 'province']" :key="field" class="block">
                                    <span class="text-sm font-semibold text-gray-700">
                                          {{ field === 'ward' ? 'Phường xã' : field === 'district' ? 'Quận huyện' : 'Tỉnh thành' }}
                                    </span>
                                    <input
                                          v-model="form[field as 'ward' | 'district' | 'province']"
                                          type="text"
                                          class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                                          :aria-invalid="invalidFields.includes(field)"
                                    />
                                    <span v-if="messageFor(field)" class="text-sm text-red-600">{{ messageFor(field) }}</span>
                              </label>
                        </div>

                        <label class="mt-4 block">
                              <span class="text-sm font-semibold text-gray-700"
                                    >Ghi chú <span class="font-normal">(không bắt buộc)</span></span
                              >
                              <textarea v-model="form.note" rows="2" class="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
                        </label>

                        <p class="mt-6 rounded bg-gray-50 p-3 text-sm text-gray-600">
                              Thanh toán khi nhận hàng. Chuyển khoản và thẻ sẽ có ở bản cập nhật sau.
                        </p>

                        <p v-if="submitError" class="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
                              {{ submitError }}
                        </p>

                        <button
                              type="submit"
                              class="mt-4 w-full rounded bg-brand py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                              :disabled="isSubmitting || hasOutOfStockLine"
                        >
                              {{ isSubmitting ? 'Đang đặt hàng…' : 'Đặt hàng' }}
                        </button>

                        <p v-if="hasOutOfStockLine" class="mt-2 text-center text-sm text-gray-500">
                              Xoá các dòng đã hết hàng trong giỏ để tiếp tục.
                        </p>
                  </form>

                  <aside class="rounded border border-gray-200 p-4">
                        <h2 class="font-semibold">Đơn hàng</h2>

                        <ul class="mt-3 divide-y divide-gray-200 text-sm">
                              <li
                                    v-for="line in cart.lines"
                                    :key="line.sku"
                                    class="flex justify-between gap-3 py-2"
                                    :class="line.sku === blockedSku || line.isOutOfStock ? 'text-red-700' : ''"
                              >
                                    <span>
                                          {{ line.productName }}
                                          <span class="text-gray-500"
                                                >{{ line.colorName }} · {{ line.sizeName }} · ×{{ line.quantity }}</span
                                          >
                                          <!--
                                                Dòng chặn đơn được đánh dấu ngay tại đây. Báo chung chung
                                                ở đầu form thì khách phải tự dò xem dòng nào có vấn đề.
                                          -->
                                          <span v-if="line.sku === blockedSku" class="block font-medium">Dòng này chặn đơn</span>
                                          <span v-else-if="line.isOutOfStock" class="block font-medium">Đã hết hàng</span>
                                    </span>
                                    <span class="shrink-0">{{ formatVndFromJson(line.lineTotal) }}</span>
                              </li>
                        </ul>

                        <dl class="mt-4 space-y-1 border-t border-gray-200 pt-3 text-sm">
                              <div class="flex justify-between">
                                    <dt class="text-gray-600">Tạm tính</dt>
                                    <dd>{{ formatVndFromJson(cart.subtotal) }}</dd>
                              </div>
                              <div class="flex justify-between">
                                    <dt class="text-gray-600">Phí vận chuyển</dt>
                                    <dd>Miễn phí</dd>
                              </div>
                              <div class="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                                    <dt>Tổng cộng</dt>
                                    <dd>{{ formatVndFromJson(cart.subtotal) }}</dd>
                              </div>
                        </dl>
                  </aside>
            </div>
      </QueryState>
</template>

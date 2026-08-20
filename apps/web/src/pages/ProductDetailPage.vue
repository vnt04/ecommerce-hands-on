<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { formatVndFromJson } from '@shopflow/shared';
import { computed, ref, watch } from 'vue';

import { fetchProduct } from '../api/catalog.js';
import QueryState from '../components/QueryState.vue';
import { useCart } from '../composables/useCart.js';

const props = defineProps<{ slug: string }>();

const query = useQuery({
      queryKey: computed(() => ['product', props.slug]),
      queryFn: async () => (await fetchProduct(props.slug)).data,
});

const product = computed(() => query.data.value);

const selectedColorCode = ref<string | undefined>(undefined);
const selectedSizeName = ref<string | undefined>(undefined);

// Chọn sẵn màu đầu tiên khi dữ liệu về, và đặt lại khi chuyển sang sản phẩm khác.
watch(
      product,
      (value) => {
            selectedColorCode.value = value?.colors[0]?.code;
            selectedSizeName.value = undefined;
      },
      { immediate: true },
);

const selectedColor = computed(() => product.value?.colors.find((color) => color.code === selectedColorCode.value));

/** Biến thể của màu đang chọn, tra theo tên size. */
const variantsBySize = computed(() => {
      const map = new Map<string, { sku: string; price: string; inStock: boolean }>();

      for (const variant of product.value?.variants ?? []) {
            if (variant.colorCode === selectedColorCode.value) {
                  map.set(variant.sizeName, variant);
            }
      }

      return map;
});

const selectedVariant = computed(() =>
      selectedSizeName.value === undefined ? undefined : variantsBySize.value.get(selectedSizeName.value),
);

const displayPrice = computed(() => {
      const variant = selectedVariant.value;

      if (variant !== undefined) {
            return formatVndFromJson(variant.price);
      }

      const prices = [...variantsBySize.value.values()].map((item) => BigInt(item.price));

      return prices.length === 0 ? '' : formatVndFromJson(prices.reduce((min, price) => (price < min ? price : min)).toString());
});

const { addItem, notice, isMutating } = useCart();

/** Đã thêm thành công lần gần nhất, để hiện xác nhận ngay cạnh nút. */
const justAdded = ref(false);

// Đổi màu hoặc size là bắt đầu một lựa chọn khác, nên xác nhận cũ không còn đúng.
watch([selectedColorCode, selectedSizeName], () => {
      justAdded.value = false;
});

async function addSelectionToCart(): Promise<void> {
      const variant = selectedVariant.value;

      if (variant === undefined) {
            return;
      }

      await addItem(variant.sku, 1);
      justAdded.value = true;
}

const sizeChartRows = computed(() => {
      const measurements = product.value?.sizeChart?.measurements;

      return Array.isArray(measurements) ? (measurements as Array<Record<string, unknown>>) : [];
});
</script>

<template>
      <QueryState :is-pending="query.isPending.value" :error="query.error.value" :is-empty="false">
            <article v-if="product">
                  <RouterLink to="/" class="text-sm text-gray-500 hover:underline">← Tất cả thiết kế</RouterLink>

                  <h1 class="mt-2 text-2xl font-bold text-brand">{{ product.name }}</h1>
                  <p class="mt-1 text-xl">{{ displayPrice }}</p>

                  <div class="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div>
                              <ul v-if="selectedColor && selectedColor.images.length > 0" class="grid grid-cols-2 gap-2">
                                    <li v-for="image in selectedColor.images" :key="image.url">
                                          <img :src="image.url" :alt="image.altText ?? product.name" class="w-full rounded" />
                                    </li>
                              </ul>
                              <p v-else class="flex h-48 items-center justify-center rounded bg-gray-100 text-sm text-gray-500">
                                    Chưa có ảnh cho màu này
                              </p>
                        </div>

                        <div>
                              <fieldset>
                                    <legend class="text-sm font-semibold text-gray-700">Màu: {{ selectedColor?.name }}</legend>
                                    <div class="mt-2 flex gap-2">
                                          <button
                                                v-for="color in product.colors"
                                                :key="color.code"
                                                type="button"
                                                class="size-9 rounded-full border-2 transition"
                                                :class="selectedColorCode === color.code ? 'border-brand scale-110' : 'border-gray-300'"
                                                :style="{ backgroundColor: color.hexCode }"
                                                :aria-label="color.name"
                                                :aria-pressed="selectedColorCode === color.code"
                                                @click="selectedColorCode = color.code"
                                          />
                                    </div>
                              </fieldset>

                              <fieldset class="mt-6">
                                    <legend class="text-sm font-semibold text-gray-700">Size</legend>
                                    <div class="mt-2 flex flex-wrap gap-2">
                                          <!--
                                                Size hết hàng hiển thị vô hiệu hoá chứ không ẩn (ràng buộc R9).
                                                Ẩn đi khiến khách tưởng shop không bán size đó.
                                                aria-disabled để trình đọc màn hình cũng biết.
                                          -->
                                          <button
                                                v-for="size in product.sizes"
                                                :key="size.name"
                                                type="button"
                                                class="min-w-12 rounded border px-3 py-2"
                                                :class="[
                                                      selectedSizeName === size.name
                                                            ? 'border-brand bg-brand text-white'
                                                            : 'border-gray-300',
                                                      variantsBySize.get(size.name)?.inStock
                                                            ? ''
                                                            : 'cursor-not-allowed text-gray-400 line-through',
                                                ]"
                                                :disabled="!variantsBySize.get(size.name)?.inStock"
                                                :aria-disabled="!variantsBySize.get(size.name)?.inStock"
                                                :aria-pressed="selectedSizeName === size.name"
                                                @click="selectedSizeName = size.name"
                                          >
                                                {{ size.name }}
                                          </button>
                                    </div>
                              </fieldset>

                              <!--
                                    Nút chỉ mở khi đã chọn đủ màu và size. Cho bấm khi chưa chọn
                                    rồi báo lỗi là bắt khách đoán xem còn thiếu gì.
                              -->
                              <button
                                    type="button"
                                    class="mt-6 w-full rounded bg-brand py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                                    :disabled="!selectedVariant || isMutating"
                                    @click="addSelectionToCart()"
                              >
                                    {{ isMutating ? 'Đang thêm…' : 'Thêm vào giỏ' }}
                              </button>

                              <p v-if="!selectedSizeName" class="mt-2 text-sm text-gray-500">Chọn size để thêm vào giỏ.</p>
                              <p v-else-if="notice" class="mt-2 text-sm text-amber-700" role="status">{{ notice }}</p>
                              <p v-else-if="justAdded" class="mt-2 text-sm text-green-700" role="status">
                                    Đã thêm vào giỏ.
                                    <RouterLink to="/gio-hang" class="underline">Xem giỏ hàng</RouterLink>
                              </p>

                              <dl class="mt-8 text-sm">
                                    <template v-if="product.material">
                                          <dt class="font-semibold">Chất liệu</dt>
                                          <dd class="mb-2">{{ product.material }}</dd>
                                    </template>
                                    <template v-if="product.printMethod">
                                          <dt class="font-semibold">Công nghệ in</dt>
                                          <dd class="mb-2">{{ product.printMethod }}</dd>
                                    </template>
                                    <template v-if="product.careGuide">
                                          <dt class="font-semibold">Hướng dẫn bảo quản</dt>
                                          <dd>{{ product.careGuide }}</dd>
                                    </template>
                              </dl>
                        </div>
                  </div>

                  <section v-if="sizeChartRows.length > 0" class="mt-10">
                        <h2 class="font-semibold">{{ product.sizeChart?.name }}</h2>
                        <p class="mt-1 text-sm text-gray-500">Số đo thật của áo. Size Việt Nam thường nhỏ hơn size quốc tế.</p>

                        <div class="mt-3 overflow-x-auto">
                              <table class="w-full min-w-md border-collapse text-sm">
                                    <thead>
                                          <tr class="border-b border-gray-300 text-left">
                                                <th v-for="key in Object.keys(sizeChartRows[0] ?? {})" :key="key" class="py-2 pr-4">
                                                      {{ key }}
                                                </th>
                                          </tr>
                                    </thead>
                                    <tbody>
                                          <tr v-for="(row, index) in sizeChartRows" :key="index" class="border-b border-gray-200">
                                                <td v-for="key in Object.keys(row)" :key="key" class="py-2 pr-4">{{ row[key] }}</td>
                                          </tr>
                                    </tbody>
                              </table>
                        </div>
                  </section>
            </article>
      </QueryState>
</template>

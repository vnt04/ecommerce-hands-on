<script setup lang="ts">
import { formatVndFromJson, type AdminVariant } from '@shopflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';

import { adjustStock, fetchAdminProduct, removeImage, updateProduct, updateVariant, uploadImage } from '../../api/adminCatalog.js';
import { ApiError } from '../../api/client.js';
import QueryState from '../../components/QueryState.vue';

const props = defineProps<{ slug: string }>();

const queryClient = useQueryClient();
const actionError = ref<string | undefined>(undefined);
const actionNotice = ref<string | undefined>(undefined);

const queryKey = computed(() => ['admin-product', props.slug]);

const query = useQuery({ queryKey, queryFn: () => fetchAdminProduct(props.slug) });
const product = computed(() => query.data.value);

/** Bản nháp trên bảng biến thể: sửa nhiều dòng rồi lưu một lần. */
const priceDrafts = ref<Record<string, string>>({});
const stockDrafts = ref<Record<string, number>>({});
const reason = ref('');

function refresh(): void {
      void queryClient.invalidateQueries({ queryKey: queryKey.value });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
}

function describeError(error: unknown): string {
      return error instanceof ApiError ? error.message : 'Không thực hiện được thao tác';
}

const publishMutation = useMutation({
      mutationFn: (change: Parameters<typeof updateProduct>[1]) => updateProduct(props.slug, change),
      onSuccess: (updated) => {
            queryClient.setQueryData(queryKey.value, updated);
            void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
            actionError.value = undefined;
      },
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

const priceMutation = useMutation({
      mutationFn: (input: { sku: string; price: string }) =>
            updateVariant(input.sku, { price: input.price, reason: reason.value || undefined }),
      onSuccess: (_history, input) => {
            delete priceDrafts.value[input.sku];
            actionNotice.value = 'Đã đổi giá ' + input.sku;
            actionError.value = undefined;
            refresh();
      },
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

const activeMutation = useMutation({
      mutationFn: (input: { sku: string; isActive: boolean }) => updateVariant(input.sku, { isActive: input.isActive }),
      onSuccess: () => {
            actionError.value = undefined;
            refresh();
      },
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

const stockMutation = useMutation({
      mutationFn: (input: { sku: string; delta: number }) => adjustStock(input.sku, input.delta, reason.value || undefined),
      onSuccess: (result) => {
            delete stockDrafts.value[result.sku];
            actionNotice.value = 'Tồn của ' + result.sku + ' giờ là ' + result.stockAfter;
            actionError.value = undefined;
            refresh();
      },
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

const uploadMutation = useMutation({
      mutationFn: (input: { file: File; colorCode?: string }) =>
            uploadImage({ file: input.file, productSlug: props.slug, colorCode: input.colorCode }),
      onSuccess: () => {
            preview.value = undefined;
            pendingFile.value = undefined;
            actionError.value = undefined;
            refresh();
      },
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

const removeImageMutation = useMutation({
      mutationFn: (id: string) => removeImage(id),
      onSuccess: refresh,
      onError: (error: unknown) => {
            actionError.value = describeError(error);
      },
});

/** Xem trước ảnh trước khi gửi, để không tải nhầm tệp lên rồi phải gỡ. */
const preview = ref<string | undefined>(undefined);
const pendingFile = ref<File | undefined>(undefined);
const uploadColorCode = ref('');

function pickFile(event: Event): void {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (file === undefined) {
            return;
      }

      pendingFile.value = file;
      preview.value = URL.createObjectURL(file);
}

function confirmUpload(): void {
      if (pendingFile.value !== undefined) {
            uploadMutation.mutate({ file: pendingFile.value, colorCode: uploadColorCode.value || undefined });
      }
}

function priceOf(variant: AdminVariant): string {
      return priceDrafts.value[variant.sku] ?? variant.price;
}

const isBusy = computed(
      () =>
            priceMutation.isPending.value ||
            activeMutation.isPending.value ||
            stockMutation.isPending.value ||
            uploadMutation.isPending.value ||
            publishMutation.isPending.value,
);
</script>

<template>
      <QueryState :is-pending="query.isPending.value" :error="query.error.value" :is-empty="false">
            <article v-if="product">
                  <RouterLink to="/quan-tri/thiet-ke" class="text-sm text-gray-500 hover:underline">← Tất cả thiết kế</RouterLink>

                  <div class="mt-2 flex flex-wrap items-center gap-3">
                        <h1 class="text-2xl font-bold text-brand">{{ product.name }}</h1>
                        <span class="font-mono text-xs text-gray-500">{{ product.designCode }}</span>
                        <span
                              class="rounded-full px-3 py-1 text-xs font-semibold"
                              :class="product.status === 'PUBLISHED' ? 'bg-green-100 text-green-900' : 'bg-gray-200 text-gray-700'"
                        >
                              {{ product.status === 'PUBLISHED' ? 'Đang bán' : 'Bản nháp' }}
                        </span>
                        <span v-if="product.isArchived" class="text-xs text-gray-500">Đã lưu trữ</span>
                  </div>

                  <div class="mt-4 flex flex-wrap gap-2">
                        <button
                              v-if="product.status === 'DRAFT'"
                              type="button"
                              class="rounded bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              :disabled="isBusy"
                              @click="publishMutation.mutate({ status: 'PUBLISHED' })"
                        >
                              Xuất bản
                        </button>
                        <button
                              v-else
                              type="button"
                              class="rounded border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                              :disabled="isBusy"
                              @click="publishMutation.mutate({ status: 'DRAFT' })"
                        >
                              Chuyển về bản nháp
                        </button>

                        <!-- Lưu trữ thay cho xoá: thiết kế đã vào đơn hàng không được xoá (R8). -->
                        <button
                              type="button"
                              class="rounded border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                              :disabled="isBusy"
                              @click="publishMutation.mutate({ archived: !product.isArchived })"
                        >
                              {{ product.isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ' }}
                        </button>
                  </div>

                  <p v-if="actionError" class="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{{ actionError }}</p>
                  <p v-else-if="actionNotice" class="mt-4 rounded bg-green-50 p-3 text-sm text-green-800" role="status">
                        {{ actionNotice }}
                  </p>

                  <label class="mt-6 block max-w-md text-sm">
                        <span class="text-gray-600">Lý do <span class="text-gray-400">(gắn vào lịch sử của thao tác tiếp theo)</span></span>
                        <input
                              v-model="reason"
                              type="text"
                              placeholder="Nhập hàng đợt 3, tăng giá vải…"
                              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        />
                  </label>

                  <h2 class="mt-8 font-semibold">Tổ hợp ({{ product.variants.length }})</h2>

                  <div class="mt-3 overflow-x-auto">
                        <table class="w-full min-w-3xl border-collapse text-sm">
                              <thead>
                                    <tr class="border-b border-gray-300 text-left">
                                          <th class="py-2 pr-4">SKU</th>
                                          <th class="py-2 pr-4">Màu</th>
                                          <th class="py-2 pr-4">Size</th>
                                          <th class="py-2 pr-4">Giá</th>
                                          <th class="py-2 pr-4 text-right">Tồn</th>
                                          <th class="py-2 pr-4">Nhập thêm</th>
                                          <th class="py-2 pr-4">Bán</th>
                                    </tr>
                              </thead>
                              <tbody>
                                    <tr v-for="variant in product.variants" :key="variant.sku" class="border-b border-gray-200">
                                          <td class="py-2 pr-4 font-mono text-xs">{{ variant.sku }}</td>
                                          <td class="py-2 pr-4">
                                                <span class="inline-flex items-center gap-2">
                                                      <span
                                                            class="size-4 rounded-full border border-gray-300"
                                                            :style="{ backgroundColor: variant.colorHex }"
                                                      />
                                                      {{ variant.colorName }}
                                                </span>
                                          </td>
                                          <td class="py-2 pr-4">{{ variant.sizeName }}</td>
                                          <td class="py-2 pr-4">
                                                <span class="flex items-center gap-2">
                                                      <input
                                                            type="text"
                                                            inputmode="numeric"
                                                            class="w-28 rounded border border-gray-300 px-2 py-1"
                                                            :value="priceOf(variant)"
                                                            :aria-label="'Giá ' + variant.sku"
                                                            @input="priceDrafts[variant.sku] = ($event.target as HTMLInputElement).value"
                                                      />
                                                      <button
                                                            v-if="
                                                                  priceDrafts[variant.sku] !== undefined &&
                                                                  priceDrafts[variant.sku] !== variant.price
                                                            "
                                                            type="button"
                                                            class="rounded bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                                            :disabled="isBusy"
                                                            @click="priceMutation.mutate({ sku: variant.sku, price: priceOf(variant) })"
                                                      >
                                                            Lưu
                                                      </button>
                                                      <span v-else class="text-xs text-gray-500">{{
                                                            formatVndFromJson(variant.price)
                                                      }}</span>
                                                </span>
                                          </td>
                                          <td
                                                class="py-2 pr-4 text-right font-semibold"
                                                :class="variant.stockQuantity === 0 ? 'text-red-600' : ''"
                                          >
                                                {{ variant.stockQuantity }}
                                          </td>
                                          <td class="py-2 pr-4">
                                                <span class="flex items-center gap-2">
                                                      <!--
                                                            Nhập theo lượng cộng thêm, không theo số cuối. Xem quyết
                                                            định 2 của S09b: đặt số cuối sẽ xoá mất những đơn đặt xen
                                                            vào giữa lúc đọc và lúc ghi.
                                                      -->
                                                      <input
                                                            type="number"
                                                            class="w-20 rounded border border-gray-300 px-2 py-1"
                                                            :value="stockDrafts[variant.sku] ?? ''"
                                                            :aria-label="'Lượng nhập thêm cho ' + variant.sku"
                                                            @input="
                                                                  stockDrafts[variant.sku] = Number(
                                                                        ($event.target as HTMLInputElement).value,
                                                                  )
                                                            "
                                                      />
                                                      <button
                                                            type="button"
                                                            class="rounded border border-gray-300 px-2 py-1 text-xs font-semibold disabled:opacity-50"
                                                            :disabled="isBusy || !stockDrafts[variant.sku]"
                                                            @click="
                                                                  stockMutation.mutate({
                                                                        sku: variant.sku,
                                                                        delta: stockDrafts[variant.sku] ?? 0,
                                                                  })
                                                            "
                                                      >
                                                            Ghi
                                                      </button>
                                                      <span v-if="stockDrafts[variant.sku]" class="text-xs text-gray-500">
                                                            → {{ variant.stockQuantity + (stockDrafts[variant.sku] ?? 0) }}
                                                      </span>
                                                </span>
                                          </td>
                                          <td class="py-2 pr-4">
                                                <input
                                                      type="checkbox"
                                                      :checked="variant.isActive"
                                                      :aria-label="'Bán ' + variant.sku"
                                                      :disabled="isBusy"
                                                      @change="
                                                            activeMutation.mutate({
                                                                  sku: variant.sku,
                                                                  isActive: ($event.target as HTMLInputElement).checked,
                                                            })
                                                      "
                                                />
                                          </td>
                                    </tr>
                              </tbody>
                        </table>
                  </div>

                  <h2 class="mt-8 font-semibold">Ảnh ({{ product.images.length }})</h2>

                  <ul v-if="product.images.length > 0" class="mt-3 flex flex-wrap gap-3">
                        <li v-for="image in product.images" :key="image.id" class="w-32">
                              <img :src="image.url" :alt="image.altText ?? product.name" class="h-32 w-32 rounded object-cover" />
                              <button
                                    type="button"
                                    class="mt-1 text-xs text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50"
                                    :disabled="isBusy"
                                    @click="removeImageMutation.mutate(image.id)"
                              >
                                    Gỡ ảnh
                              </button>
                        </li>
                  </ul>

                  <div class="mt-4 flex flex-wrap items-end gap-3">
                        <label class="text-sm">
                              <span class="block text-gray-600">Chọn ảnh</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp" class="mt-1" @change="pickFile($event)" />
                        </label>

                        <label class="text-sm">
                              <span class="block text-gray-600">Gán cho màu</span>
                              <select v-model="uploadColorCode" class="mt-1 rounded border border-gray-300 px-2 py-2">
                                    <option value="">Dùng chung</option>
                                    <option v-for="variant in product.variants" :key="variant.colorCode" :value="variant.colorCode">
                                          {{ variant.colorName }}
                                    </option>
                              </select>
                        </label>

                        <div v-if="preview" class="flex items-end gap-2">
                              <img :src="preview" alt="Xem trước" class="h-20 w-20 rounded object-cover" />
                              <button
                                    type="button"
                                    class="rounded bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    :disabled="isBusy"
                                    @click="confirmUpload()"
                              >
                                    {{ uploadMutation.isPending.value ? 'Đang tải lên…' : 'Tải lên' }}
                              </button>
                        </div>
                  </div>
            </article>
      </QueryState>
</template>

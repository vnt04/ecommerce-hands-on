<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, watch } from 'vue';

import { CART_QUERY_KEY, useCart } from './composables/useCart.js';
import { useSessionStore } from './stores/session.js';

const session = useSessionStore();
const queryClient = useQueryClient();
const { cart } = useCart();

const itemCount = computed(() => cart.value.itemCount);

/**
 * Đăng nhập, đăng ký hay đăng xuất đều đổi giỏ đang dùng: backend gộp giỏ ẩn danh
 * vào giỏ tài khoản lúc đăng nhập, và sau khi đăng xuất thì giỏ tài khoản không
 * còn thuộc về phiên này nữa. Bỏ dòng watch này thì header giữ nguyên số cũ.
 */
watch(
      () => session.user?.id,
      () => {
            void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      },
);

// Access token nằm trong bộ nhớ nên tải lại trang là mất. Refresh token nằm trong
// cookie httpOnly nên vẫn còn: một lần refresh lúc khởi động là đủ để có phiên lại.
onMounted(() => {
      void session.restore();
});
</script>

<template>
      <div class="min-h-screen bg-white font-sans text-gray-900">
            <header class="sticky top-0 z-20 border-b border-gray-200/80 bg-white/95 backdrop-blur">
                  <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                        <RouterLink to="/" class="flex items-center gap-2 text-xl font-bold tracking-tight text-brand">
                              <span
                                    class="flex size-8 items-center justify-center rounded-full bg-brand text-xs text-white"
                                    aria-hidden="true"
                                    >S</span
                              >
                              ShopFlow
                        </RouterLink>

                        <nav v-if="!session.isRestoring" class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
                              <RouterLink to="/gio-hang" class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand">
                                    Giỏ hàng
                                    <span
                                          v-if="itemCount > 0"
                                          class="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
                                          aria-label="Số sản phẩm trong giỏ"
                                    >
                                          {{ itemCount }}
                                    </span>
                              </RouterLink>

                              <template v-if="session.user">
                                    <template v-if="session.user.role === 'ADMIN'">
                                          <RouterLink
                                                to="/quan-tri/don-hang"
                                                class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand"
                                                >Đơn (QT)</RouterLink
                                          >
                                          <RouterLink
                                                to="/quan-tri/thiet-ke"
                                                class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand"
                                                >Thiết kế</RouterLink
                                          >
                                    </template>
                                    <RouterLink to="/don-hang" class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand"
                                          >Đơn hàng</RouterLink
                                    >
                                    <span class="hidden max-w-32 truncate text-gray-500 sm:inline">{{ session.user.fullName }}</span>
                                    <button
                                          type="button"
                                          class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand"
                                          @click="session.logout()"
                                    >
                                          Đăng xuất
                                    </button>
                              </template>
                              <template v-else>
                                    <RouterLink to="/dang-nhap" class="rounded-md px-2 py-1 hover:bg-gray-100 hover:text-brand"
                                          >Đăng nhập</RouterLink
                                    >
                                    <RouterLink
                                          to="/dang-ky"
                                          class="rounded-full bg-brand px-4 py-2 font-medium text-white transition hover:bg-[#263a63]"
                                    >
                                          Tạo tài khoản
                                    </RouterLink>
                              </template>
                        </nav>
                  </div>
            </header>

            <main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                  <RouterView />
            </main>

            <footer class="mt-12 border-t border-gray-200 bg-[#fafaf9]">
                  <div
                        class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                        <span class="font-semibold tracking-tight text-brand">ShopFlow</span>
                        <span>Áo thun in sẵn · Chọn màu, chọn size, mặc theo cách của bạn.</span>
                  </div>
            </footer>
      </div>
</template>

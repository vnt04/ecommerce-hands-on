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
            <header class="border-b border-gray-200">
                  <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
                        <RouterLink to="/" class="text-xl font-bold text-brand">ShopFlow</RouterLink>

                        <nav v-if="!session.isRestoring" class="flex items-center gap-4 text-sm">
                              <RouterLink to="/gio-hang" class="hover:underline">
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
                                    <RouterLink v-if="session.user.role === 'ADMIN'" to="/quan-tri/don-hang" class="hover:underline">
                                          Quản trị
                                    </RouterLink>
                                    <RouterLink to="/don-hang" class="hover:underline">Đơn hàng</RouterLink>
                                    <span>{{ session.user.fullName }}</span>
                                    <button type="button" class="hover:underline" @click="session.logout()">Đăng xuất</button>
                              </template>
                              <template v-else>
                                    <RouterLink to="/dang-nhap" class="hover:underline">Đăng nhập</RouterLink>
                                    <RouterLink to="/dang-ky" class="rounded bg-brand px-3 py-1.5 text-white"> Tạo tài khoản </RouterLink>
                              </template>
                        </nav>
                  </div>
            </header>

            <main class="mx-auto max-w-5xl px-4 py-8">
                  <RouterView />
            </main>
      </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useSessionStore } from './stores/session.js';

const session = useSessionStore();

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
                              <template v-if="session.user">
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

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api/client.js';
import { useSessionStore } from '../stores/session.js';

const props = defineProps<{ mode: 'login' | 'register' }>();

const router = useRouter();
const route = useRoute();
const session = useSessionStore();

const email = ref('');
const password = ref('');
const fullName = ref('');
const errorMessage = ref<string | undefined>(undefined);
const isSubmitting = ref(false);

async function submit(): Promise<void> {
      errorMessage.value = undefined;
      isSubmitting.value = true;

      try {
            if (props.mode === 'register') {
                  await session.register({ email: email.value, password: password.value, fullName: fullName.value });
            } else {
                  await session.login(email.value, password.value);
            }

            /**
             * Quay lại nơi khách đang định tới, nếu có.
             *
             * Bấm "Đặt hàng" rồi bị đưa về trang đăng nhập, đăng nhập xong lại rơi về
             * trang chủ là bắt khách đi lại từ đầu. Chỉ nhận đường dẫn nội bộ: nhận
             * URL tuỳ ý ở đây là một lỗ chuyển hướng mở.
             */
            const next = route.query.tiep_tuc;
            const target = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';

            await router.push(target);
      } catch (error) {
            // Hiển thị thông báo do máy chủ trả về: nó đã được viết để không tiết lộ
            // email nào tồn tại trong hệ thống.
            errorMessage.value = error instanceof ApiError ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại';
      } finally {
            isSubmitting.value = false;
      }
}
</script>

<template>
      <section class="mx-auto max-w-sm">
            <h1 class="text-2xl font-bold text-brand">
                  {{ props.mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập' }}
            </h1>

            <form class="mt-6 space-y-4" @submit.prevent="submit">
                  <div v-if="props.mode === 'register'">
                        <label for="fullName" class="block text-sm font-semibold text-gray-700">Họ tên</label>
                        <input
                              id="fullName"
                              v-model="fullName"
                              type="text"
                              required
                              autocomplete="name"
                              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        />
                  </div>

                  <div>
                        <label for="email" class="block text-sm font-semibold text-gray-700">Email</label>
                        <input
                              id="email"
                              v-model="email"
                              type="email"
                              required
                              autocomplete="email"
                              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        />
                  </div>

                  <div>
                        <label for="password" class="block text-sm font-semibold text-gray-700">Mật khẩu</label>
                        <input
                              id="password"
                              v-model="password"
                              type="password"
                              required
                              :autocomplete="props.mode === 'register' ? 'new-password' : 'current-password'"
                              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        />
                  </div>

                  <p v-if="errorMessage" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                        {{ errorMessage }}
                  </p>

                  <button type="submit" :disabled="isSubmitting" class="w-full rounded bg-brand py-2 text-white disabled:opacity-50">
                        {{ isSubmitting ? 'Đang xử lý…' : props.mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập' }}
                  </button>
            </form>

            <p class="mt-4 text-sm text-gray-600">
                  <RouterLink v-if="props.mode === 'login'" to="/dang-ky" class="hover:underline"> Chưa có tài khoản? Tạo mới </RouterLink>
                  <RouterLink v-else to="/dang-nhap" class="hover:underline">Đã có tài khoản? Đăng nhập</RouterLink>
            </p>
      </section>
</template>

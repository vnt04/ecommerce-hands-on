import { defineStore } from 'pinia';
import { ref } from 'vue';

import * as authApi from '../api/auth.js';
import { onSessionExpiredHandler, refreshSession } from '../api/client.js';

/**
 * Trạng thái phiên đăng nhập.
 *
 * Pinia chỉ giữ trạng thái phía client. Dữ liệu lấy từ máy chủ do TanStack Query
 * quản lý — nhồi dữ liệu máy chủ vào đây rồi tự viết logic làm mới là nguồn bug
 * đồng bộ phổ biến nhất trong ứng dụng một trang.
 *
 * Access token không nằm trong store mà nằm trong module api client, và chỉ trong
 * bộ nhớ. Không ghi vào localStorage: script XSS đọc được nơi đó.
 */
export const useSessionStore = defineStore('session', () => {
      const user = ref<authApi.SessionUser | undefined>(undefined);
      const isRestoring = ref(true);

      onSessionExpiredHandler(() => {
            user.value = undefined;
      });

      /**
       * Dựng lại phiên sau khi tải lại trang.
       *
       * Access token nằm trong bộ nhớ nên tải lại là mất. Refresh token nằm trong
       * cookie httpOnly nên vẫn còn, và một lần refresh là đủ để có phiên trở lại.
       */
      async function restore(): Promise<void> {
            isRestoring.value = true;

            try {
                  if (await refreshSession()) {
                        user.value = await authApi.fetchCurrentUser();
                  }
            } catch {
                  user.value = undefined;
            } finally {
                  isRestoring.value = false;
            }
      }

      async function login(email: string, password: string): Promise<void> {
            user.value = await authApi.login({ email, password });
      }

      async function register(input: { email: string; password: string; fullName: string }): Promise<void> {
            user.value = await authApi.register(input);
      }

      async function logout(): Promise<void> {
            await authApi.logout();
            user.value = undefined;
      }

      return { user, isRestoring, restore, login, register, logout };
});

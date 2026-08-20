import './style.css';

import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router/index.js';

const RETRY_ATTEMPTS = 1;
const STALE_TIME_MS = 30_000;

createApp(App)
      .use(createPinia())
      .use(router)
      .use(VueQueryPlugin, {
            queryClientConfig: {
                  defaultOptions: {
                        queries: {
                              /**
                               * Mặc định của thư viện là thử lại ba lần kèm giãn cách, tức khách
                               * nhìn màn hình đang tải khoảng bảy giây trước khi biết là hỏng.
                               * Một lần thử lại đủ để vượt qua trục trặc mạng thoáng qua.
                               */
                              retry: RETRY_ATTEMPTS,
                              staleTime: STALE_TIME_MS,
                        },
                  },
            },
      })
      .mount('#app');

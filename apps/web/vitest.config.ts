import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
      plugins: [vue()],
      test: {
            // happy-dom nhẹ hơn jsdom và đủ cho component không dùng API trình duyệt phức tạp.
            environment: 'happy-dom',
      },
});

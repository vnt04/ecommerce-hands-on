import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const WEB_PORT = 5173;

/**
 * Đích của proxy đọc từ biến môi trường vì nó khác nhau theo cách chạy:
 * chạy trực tiếp trên máy là http://localhost:3000, chạy trong Docker Compose
 * là http://api:3000 (tên service trong mạng nội bộ). Cố định một giá trị
 * sẽ làm hỏng cách chạy còn lại.
 */
const API_TARGET = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Bind mount trên macOS và Windows không phát sinh sự kiện inotify đáng tin cậy,
 * nên hot reload cần chuyển sang polling. Trên Linux và WSL thì không, vì polling
 * tốn CPU liên tục. Điều khiển bằng biến môi trường thay vì cố định trong mã.
 */
const POLLING_INTERVAL_MS = 300;
const usePolling = process.env.WATCH_POLLING === 'true';

export default defineConfig({
  plugins: [vue()],
  server: {
    // 0.0.0.0 để truy cập được từ ngoài container.
    host: '0.0.0.0',
    port: WEB_PORT,
    watch: usePolling ? { usePolling: true, interval: POLLING_INTERVAL_MS } : undefined,
    proxy: {
      // Web luôn gọi qua /api để môi trường phát triển và production cùng là
      // same-origin. Prefix được bỏ trước khi chuyển tiếp vì api chưa có nó.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

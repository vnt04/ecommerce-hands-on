import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import { useSessionStore } from '../stores/session.js';

const routes: RouteRecordRaw[] = [
      {
            path: '/',
            name: 'products',
            component: () => import('../pages/ProductListPage.vue'),
      },
      {
            path: '/san-pham/:slug',
            name: 'product-detail',
            component: () => import('../pages/ProductDetailPage.vue'),
            props: true,
      },
      {
            path: '/gio-hang',
            name: 'cart',
            component: () => import('../pages/CartPage.vue'),
      },
      {
            path: '/thanh-toan',
            name: 'checkout',
            component: () => import('../pages/CheckoutPage.vue'),
            meta: { requiresAuth: true },
      },
      {
            path: '/don-hang',
            name: 'orders',
            component: () => import('../pages/OrderListPage.vue'),
            meta: { requiresAuth: true },
      },
      {
            path: '/don-hang/:orderNumber',
            name: 'order-detail',
            component: () => import('../pages/OrderDetailPage.vue'),
            props: true,
            meta: { requiresAuth: true },
      },
      {
            path: '/dang-nhap',
            name: 'login',
            component: () => import('../pages/LoginPage.vue'),
            props: { mode: 'login' },
      },
      {
            path: '/dang-ky',
            name: 'register',
            component: () => import('../pages/LoginPage.vue'),
            props: { mode: 'register' },
      },
];

/**
 * Chặn trang cần đăng nhập ngay ở client, và nhớ nơi khách định tới.
 *
 * Đây chỉ là trải nghiệm: mọi kiểm tra quyền thật nằm ở backend (ràng buộc R7).
 * Không có chặn này thì khách bấm "Đặt hàng" sẽ thấy màn hình lỗi thay vì màn
 * hình đăng nhập.
 */
export const router = createRouter({
      // Lịch sử của trình duyệt, không phải hash. Đổi lại, máy chủ phục vụ tệp tĩnh
      // phải trả index.html cho mọi đường dẫn không khớp — cấu hình ở bước lên production.
      history: createWebHistory(),
      routes,
});

router.beforeEach(async (to) => {
      if (to.meta.requiresAuth !== true) {
            return true;
      }

      const session = useSessionStore();

      // Tải lại trang là mất access token trong bộ nhớ; chờ dựng lại phiên xong mới
      // kết luận, nếu không khách đang đăng nhập vẫn bị đá về trang đăng nhập.
      if (session.isRestoring) {
            await session.restore();
      }

      return session.user === undefined ? { name: 'login', query: { tiep_tuc: to.fullPath } } : true;
});

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

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

export const router = createRouter({
      // Lịch sử của trình duyệt, không phải hash. Đổi lại, máy chủ phục vụ tệp tĩnh
      // phải trả index.html cho mọi đường dẫn không khớp — cấu hình ở bước lên production.
      history: createWebHistory(),
      routes,
});

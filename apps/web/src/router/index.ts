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
];

export const router = createRouter({
      // Lịch sử của trình duyệt, không phải hash. Đổi lại, máy chủ phục vụ tệp tĩnh
      // phải trả index.html cho mọi đường dẫn không khớp — cấu hình ở bước lên production.
      history: createWebHistory(),
      routes,
});

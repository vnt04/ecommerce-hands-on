import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import App from './App.vue';

function stubFetch(body: unknown): void {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
}

describe('App', () => {
      beforeEach(() => {
            stubFetch({ success: true, data: { status: 'ok' } });
      });

      test('hiển thị số tiền định dạng bởi @shopflow/shared', () => {
            // Phép khẳng định này xác nhận web phân giải được package trong workspace
            // lúc chạy thật, không chỉ lúc biên dịch.
            const wrapper = mount(App);

            expect(wrapper.text()).toContain('299.000 ₫');
      });

      test('đọc trạng thái từ trường data của envelope', async () => {
            const wrapper = mount(App);
            await vi.waitFor(() => {
                  expect(wrapper.text()).toContain('ok');
            });

            expect(fetch).toHaveBeenCalledWith('/api/v1/healthz');
      });

      test('hiển thị mã lỗi khi envelope báo thất bại', async () => {
            stubFetch({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Hệ thống tạm thời không sẵn sàng' } });

            const wrapper = mount(App);
            await vi.waitFor(() => {
                  expect(wrapper.text()).toContain('SERVICE_UNAVAILABLE');
            });
      });
});

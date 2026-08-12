import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import App from './App.vue';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      }),
    );
  });

  test('hiển thị số tiền định dạng bởi @shopflow/shared', () => {
    // Phép khẳng định này xác nhận web phân giải được package trong workspace
    // lúc chạy thật, không chỉ lúc biên dịch.
    const wrapper = mount(App);

    expect(wrapper.text()).toContain('299.000 ₫');
  });

  test('hiển thị trạng thái trả về từ /api/healthz', async () => {
    const wrapper = mount(App);
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('ok');
    });

    expect(fetch).toHaveBeenCalledWith('/api/healthz');
  });
});

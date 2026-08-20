import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { apiGet, ApiError, getAccessToken, refreshSession, setAccessToken } from './client.js';

type FetchCall = { url: string; init?: RequestInit };

let calls: FetchCall[];

function jsonResponse(body: unknown, status = 200): Response {
      return { ok: status < 400, status, json: () => Promise.resolve(body) } as Response;
}

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>): void {
      vi.stubGlobal(
            'fetch',
            vi.fn((url: string, init?: RequestInit) => {
                  const call = { url, init };
                  calls.push(call);

                  return Promise.resolve(handler(call));
            }),
      );
}

beforeEach(() => {
      calls = [];
      setAccessToken(undefined);
});

afterEach(() => {
      vi.unstubAllGlobals();
});

describe('apiGet', () => {
      test('bóc lớp envelope và trả về dữ liệu', async () => {
            stubFetch(() => jsonResponse({ success: true, data: { name: 'Tee' } }));

            await expect(apiGet('/products')).resolves.toEqual({ data: { name: 'Tee' }, meta: undefined });
      });

      test('gắn access token vào header khi đã đăng nhập', async () => {
            setAccessToken('token-abc');
            stubFetch(() => jsonResponse({ success: true, data: null }));

            await apiGet('/auth/me');

            expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe('Bearer token-abc');
      });

      test('không gắn header khi chưa đăng nhập', async () => {
            stubFetch(() => jsonResponse({ success: true, data: null }));

            await apiGet('/products');

            expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBeNull();
      });

      test('ném ApiError mang mã lỗi khi máy chủ trả envelope thất bại', async () => {
            stubFetch(() => jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Không thấy' } }, 404));

            await expect(apiGet('/products/x')).rejects.toThrow(ApiError);
      });

      test('ném lỗi mạng khi fetch hỏng', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

            await expect(apiGet('/products')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
      });
});

describe('làm mới phiên khi gặp 401', () => {
      test('tự gọi refresh rồi phát lại request', async () => {
            setAccessToken('token-cu');

            stubFetch((call) => {
                  if (call.url.endsWith('/auth/refresh')) {
                        return jsonResponse({ success: true, data: { accessToken: 'token-moi' } });
                  }

                  return getAccessToken() === 'token-moi'
                        ? jsonResponse({ success: true, data: { name: 'Tee' } })
                        : jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Hết hạn' } }, 401);
            });

            await expect(apiGet('/auth/me')).resolves.toEqual({ data: { name: 'Tee' }, meta: undefined });
            expect(getAccessToken()).toBe('token-moi');
      });

      test('không gọi refresh khi chưa từng đăng nhập', async () => {
            stubFetch(() => jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Chưa đăng nhập' } }, 401));

            await expect(apiGet('/auth/me')).rejects.toThrow(ApiError);
            expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(0);
      });

      test('ba request cùng nhận 401 chỉ sinh một lần gọi refresh', async () => {
            /**
             * Đây là chốt chặn quan trọng nhất của tầng này. Không gộp thì request đầu
             * xoay vòng refresh token, hai request sau gửi token đã bị thay thế, máy chủ
             * coi đó là token bị đánh cắp và thu hồi cả phiên — người dùng bị đăng xuất
             * dù không làm gì sai.
             */
            setAccessToken('token-cu');

            let refreshed = false;

            stubFetch(async (call) => {
                  if (call.url.endsWith('/auth/refresh')) {
                        // Giả lập độ trễ mạng để ba request thật sự chồng lên nhau.
                        await new Promise((resolve) => setTimeout(resolve, 10));
                        refreshed = true;

                        return jsonResponse({ success: true, data: { accessToken: 'token-moi' } });
                  }

                  return refreshed
                        ? jsonResponse({ success: true, data: 'ok' })
                        : jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Hết hạn' } }, 401);
            });

            await Promise.all([apiGet('/a'), apiGet('/b'), apiGet('/c')]);

            expect(calls.filter((call) => call.url.endsWith('/auth/refresh'))).toHaveLength(1);
      });

      test('xoá access token và báo phiên hết hạn khi refresh thất bại', async () => {
            setAccessToken('token-cu');
            stubFetch(() => jsonResponse({ success: false, error: { code: 'UNAUTHORIZED', message: 'Hết hạn' } }, 401));

            await expect(apiGet('/auth/me')).rejects.toThrow(ApiError);
            expect(getAccessToken()).toBeUndefined();
      });

      test('cho phép gọi refresh lại sau khi lần trước đã xong', async () => {
            // Lần gọi đang chạy phải được dọn đi, nếu không mọi lần refresh sau đều
            // nhận lại kết quả cũ và phiên không bao giờ làm mới được nữa.
            stubFetch(() => jsonResponse({ success: true, data: { accessToken: 'token-1' } }));
            await refreshSession();

            stubFetch(() => jsonResponse({ success: true, data: { accessToken: 'token-2' } }));
            await refreshSession();

            expect(getAccessToken()).toBe('token-2');
      });
});

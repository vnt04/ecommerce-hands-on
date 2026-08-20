import type { Envelope, ErrorCode, Meta } from '@shopflow/shared';

/** Lỗi do API trả về, mang theo mã máy đọc được để giao diện phân nhánh. */
export class ApiError extends Error {
      constructor(
            readonly code: ErrorCode | 'NETWORK_ERROR',
            message: string,
            /** Dữ liệu máy đọc được do máy chủ gửi kèm, ví dụ SKU của dòng hết hàng. */
            readonly details?: unknown,
      ) {
            super(message);
            this.name = 'ApiError';
      }
}

export type ApiResult<T> = { data: T; meta?: Meta };

type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * Access token chỉ nằm trong bộ nhớ của ứng dụng, không nằm trong localStorage
 * (ràng buộc R9 về xác thực). Script XSS đọc được localStorage; refresh token thì
 * nằm trong cookie httpOnly nên nó không chạm tới được.
 *
 * Hệ quả: tải lại trang là mất access token, và phiên được dựng lại bằng một lần
 * gọi refresh lúc khởi động.
 */
let accessToken: string | undefined;

/** Chạy khi phiên hết hiệu lực hẳn, để tầng trên dọn trạng thái đăng nhập. */
let onSessionExpired: (() => void) | undefined;

export function setAccessToken(token: string | undefined): void {
      accessToken = token;
}

export function getAccessToken(): string | undefined {
      return accessToken;
}

export function onSessionExpiredHandler(handler: () => void): void {
      onSessionExpired = handler;
}

function buildQueryString(params: QueryParams): string {
      const search = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '') {
                  search.set(key, String(value));
            }
      }

      const query = search.toString();

      return query === '' ? '' : '?' + query;
}

/**
 * Lần gọi refresh đang chạy, nếu có.
 *
 * Đây là chốt chặn quan trọng nhất của tầng này. Trang danh sách gọi vài API song
 * song; khi access token hết hạn thì tất cả cùng nhận 401 một lúc. Mỗi cái tự gọi
 * refresh thì cái đầu xoay vòng token, những cái sau gửi token đã bị thay thế, và
 * máy chủ coi đó là dấu hiệu token bị đánh cắp nên thu hồi cả phiên — người dùng
 * bị đăng xuất dù không làm gì sai.
 *
 * Gộp về một lần gọi: ai tới sau thì chờ chính lần gọi đang chạy.
 */
let pendingRefresh: Promise<boolean> | undefined;

async function requestNewAccessToken(): Promise<boolean> {
      const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });

      if (!response.ok) {
            setAccessToken(undefined);
            onSessionExpired?.();

            return false;
      }

      const body = (await response.json()) as Envelope<{ accessToken: string }>;

      if (!body.success) {
            setAccessToken(undefined);
            onSessionExpired?.();

            return false;
      }

      setAccessToken(body.data.accessToken);

      return true;
}

export async function refreshSession(): Promise<boolean> {
      pendingRefresh ??= requestNewAccessToken().finally(() => {
            pendingRefresh = undefined;
      });

      return pendingRefresh;
}

async function send(path: string, init: RequestInit): Promise<Response> {
      const headers = new Headers(init.headers);

      if (accessToken !== undefined) {
            headers.set('Authorization', 'Bearer ' + accessToken);
      }

      return fetch('/api/v1' + path, { ...init, headers });
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
      const body = (await response.json()) as Envelope<T> & { meta?: Meta };

      if (!body.success) {
            throw new ApiError(body.error.code, body.error.message, body.error.details);
      }

      return { data: body.data, meta: body.meta };
}

/**
 * Gọi API, tự làm mới phiên một lần khi gặp 401.
 *
 * Chỉ thử lại đúng một lần: nếu sau khi refresh vẫn 401 thì phiên đã hỏng thật,
 * và thử tiếp chỉ tạo vòng lặp.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
      let response: Response;

      try {
            response = await send(path, init);
      } catch {
            throw new ApiError('NETWORK_ERROR', 'Không kết nối được máy chủ');
      }

      if (response.status === 401 && accessToken !== undefined) {
            if (await refreshSession()) {
                  response = await send(path, init);
            }
      }

      return parse<T>(response);
}

export function apiGet<T>(path: string, params: QueryParams = {}): Promise<ApiResult<T>> {
      return request<T>(path + buildQueryString(params));
}

export function apiPost<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResult<T>> {
      return sendJson<T>('POST', path, body, headers);
}

export function apiPatch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
      return sendJson<T>('PATCH', path, body);
}

export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
      return request<T>(path, { method: 'DELETE' });
}

/**
 * Gửi một biểu mẫu nhiều phần, dùng để tải tệp lên.
 *
 * Không đặt `Content-Type`: trình duyệt phải tự sinh header đó kèm chuỗi phân
 * cách. Đặt tay là hỏng, và triệu chứng là máy chủ báo không tìm thấy tệp nào.
 */
export function apiUpload<T>(path: string, form: FormData): Promise<ApiResult<T>> {
      return request<T>(path, { method: 'POST', body: form });
}

function sendJson<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
      return request<T>(path, {
            method,
            headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
      });
}

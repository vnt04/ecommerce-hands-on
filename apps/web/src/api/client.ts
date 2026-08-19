import type { Envelope, ErrorCode, Meta } from '@shopflow/shared';

/** Lỗi do API trả về, mang theo mã máy đọc được để giao diện phân nhánh. */
export class ApiError extends Error {
      constructor(
            readonly code: ErrorCode | 'NETWORK_ERROR',
            message: string,
      ) {
            super(message);
            this.name = 'ApiError';
      }
}

export type ApiResult<T> = { data: T; meta?: Meta };

type QueryParams = Record<string, string | number | boolean | undefined>;

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
 * Gọi API và bóc lớp envelope.
 *
 * Mọi lời gọi đi qua đây để phần còn lại của ứng dụng không phải lặp lại việc
 * kiểm tra cờ success, và để lỗi mạng cùng lỗi nghiệp vụ cùng ném ra một kiểu.
 *
 * Đường dẫn luôn tương đối: web và api nằm sau cùng một origin nên không cần
 * cấu hình URL cơ sở, và cookie xác thực ở bước sau sẽ hoạt động không cần CORS.
 */
export async function apiGet<T>(path: string, params: QueryParams = {}): Promise<ApiResult<T>> {
      let body: Envelope<T> & { meta?: Meta };

      try {
            const response = await fetch('/api/v1' + path + buildQueryString(params));
            body = (await response.json()) as Envelope<T> & { meta?: Meta };
      } catch {
            throw new ApiError('NETWORK_ERROR', 'Không kết nối được máy chủ');
      }

      if (!body.success) {
            throw new ApiError(body.error.code, body.error.message);
      }

      return { data: body.data, meta: body.meta };
}

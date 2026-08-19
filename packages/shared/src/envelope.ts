import type { ErrorCode } from './errors.js';

/**
 * Mọi response của API dùng chung một vỏ bọc. Frontend nhờ đó chỉ cần một
 * hàm xử lý duy nhất thay vì đoán hình dạng dữ liệu theo từng endpoint.
 */
export type Meta = {
      page: number;
      limit: number;
      total: number;
};

export type SuccessEnvelope<T> = {
      success: true;
      data: T;
      meta?: Meta;
};

export type ErrorEnvelope = {
      success: false;
      error: {
            code: ErrorCode;
            message: string;
            details?: unknown;
      };
};

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

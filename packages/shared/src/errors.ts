/**
 * Catalog mã lỗi. Đây là nguồn duy nhất — cấm khai báo chuỗi mã lỗi rời rạc
 * trong apps/api. Trùng mã hoặc sai chính tả ở nơi khác sẽ không ai phát hiện
 * cho tới khi frontend xử lý nhầm nhánh.
 *
 * Frontend ra quyết định dựa trên `code`, không bao giờ dựa trên `message`.
 */
import { z } from 'zod';

import { apiSchema } from './openapi-registry.js';

export const ERROR_CODES = {
      VALIDATION_FAILED: 'VALIDATION_FAILED',
      NOT_FOUND: 'NOT_FOUND',
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      CONFLICT: 'CONFLICT',
      SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const errorCodeSchema = apiSchema('ErrorCode', z.enum(ERROR_CODES));

/** Thông báo mặc định hiển thị cho người dùng, tiếng Việt theo quy ước ngôn ngữ. */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
      VALIDATION_FAILED: 'Dữ liệu gửi lên không hợp lệ',
      NOT_FOUND: 'Không tìm thấy tài nguyên',
      UNAUTHORIZED: 'Bạn cần đăng nhập để thực hiện thao tác này',
      FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
      CONFLICT: 'Thao tác xung đột với trạng thái hiện tại',
      SERVICE_UNAVAILABLE: 'Hệ thống tạm thời không sẵn sàng',
      INTERNAL_ERROR: 'Đã có lỗi xảy ra, vui lòng thử lại',
};

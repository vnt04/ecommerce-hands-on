import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from '@shopflow/shared';

/**
 * Ánh xạ mã HTTP sang mã lỗi máy đọc được. Frontend ra quyết định dựa trên mã này.
 *
 * Bộ lọc ngoại lệ và tài liệu OpenAPI cùng đọc bảng này, nhờ vậy tài liệu không
 * thể mô tả một mã lỗi khác với mã thực sự trả về.
 */
export const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
};

/** Mã lỗi ứng với một mã HTTP. Mã không có trong bảng rơi về lỗi nội bộ. */
export function errorCodeForStatus(status: number): ErrorCode {
      return STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL_ERROR;
}

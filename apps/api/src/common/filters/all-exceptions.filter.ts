import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DEFAULT_ERROR_MESSAGES, ERROR_CODES, type ErrorCode, type ErrorEnvelope } from '@shopflow/shared';
import type { Response } from 'express';

import { DomainException } from '../errors/domain.exception.js';

/** Ánh xạ mã HTTP sang mã lỗi máy đọc được. Frontend ra quyết định dựa trên mã này. */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_FAILED,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
};

/**
 * Điểm thoát duy nhất cho mọi lỗi chưa được xử lý.
 *
 * Hai nguyên tắc: response luôn đúng hình dạng envelope, và không bao giờ lộ
 * stack trace hay chi tiết SQL ra client. Chi tiết lỗi đi vào log máy chủ,
 * nơi có requestId để lần ngược lại.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
      private readonly logger = new Logger(AllExceptionsFilter.name);

      catch(exception: unknown, host: ArgumentsHost): void {
            const response = host.switchToHttp().getResponse<Response>();

            const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
            const code = STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL_ERROR;

            // Lỗi ngoài dự kiến mới cần ghi log kèm ngăn xếp. Lỗi nghiệp vụ đã biết
            // thì ghi ở mức cảnh báo, tránh làm nhiễu tín hiệu khi truy sự cố thật.
            if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
                  this.logger.error('Yêu cầu thất bại ngoài dự kiến', exception instanceof Error ? exception.stack : String(exception));
            }

            // Lỗi nghiệp vụ đã lường trước mới được dùng thông báo và chi tiết của
            // chính nó. Mọi lỗi khác dùng thông báo mặc định, vì nội dung lỗi gốc có
            // thể chứa chi tiết SQL hoặc đường dẫn tệp.
            const body: ErrorEnvelope =
                  exception instanceof DomainException
                        ? { success: false, error: { code, message: exception.userMessage, details: exception.details } }
                        : { success: false, error: { code, message: DEFAULT_ERROR_MESSAGES[code] } };

            response.status(status).json(body);
      }
}

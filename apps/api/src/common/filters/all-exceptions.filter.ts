import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DEFAULT_ERROR_MESSAGES, type ErrorEnvelope } from '@shopflow/shared';
import type { Response } from 'express';

import { DomainException } from '../errors/domain.exception.js';
import { errorCodeForStatus } from '../errors/status-to-code.js';

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
            const code = errorCodeForStatus(status);

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

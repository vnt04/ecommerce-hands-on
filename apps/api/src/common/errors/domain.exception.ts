import { HttpException, type HttpStatus } from '@nestjs/common';

/**
 * Lỗi nghiệp vụ đã lường trước, mang theo chi tiết máy đọc được.
 *
 * Khác với lỗi thông thường ở hai điểm: thông báo do ta viết nên đưa thẳng cho
 * người dùng được, và `details` đi kèm ra tới client. Đặt hàng cần đúng điều này —
 * "một dòng hết hàng" là vô dụng nếu giỏ có sáu dòng và khách không biết dòng nào.
 *
 * Lỗi ngoài dự kiến vẫn đi đường cũ và không bao giờ lộ nội dung gốc.
 */
export class DomainException extends HttpException {
      constructor(
            status: HttpStatus,
            readonly userMessage: string,
            readonly details: Record<string, unknown>,
      ) {
            super({ message: userMessage, details }, status);
      }
}

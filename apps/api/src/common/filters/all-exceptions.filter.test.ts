import { type ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ERROR_CODES } from '@shopflow/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DomainException } from '../errors/domain.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost() {
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const host = {
            switchToHttp: () => ({ getResponse: () => ({ status }) }),
      } as unknown as ArgumentsHost;

      return { host, status, json };
}

beforeEach(() => {
      // Lỗi 500 được ghi log kèm ngăn xếp; chặn lại để output test không nhiễu.
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

describe('AllExceptionsFilter', () => {
      test('ánh xạ 404 sang mã NOT_FOUND', () => {
            const { host, status, json } = createHost();

            new AllExceptionsFilter().catch(new HttpException('không thấy', HttpStatus.NOT_FOUND), host);

            expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
            expect(json).toHaveBeenCalledWith({
                  success: false,
                  error: { code: ERROR_CODES.NOT_FOUND, message: expect.any(String) },
            });
      });

      test.each([
            [HttpStatus.BAD_REQUEST, ERROR_CODES.VALIDATION_FAILED],
            [HttpStatus.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED],
            [HttpStatus.FORBIDDEN, ERROR_CODES.FORBIDDEN],
            [HttpStatus.CONFLICT, ERROR_CODES.CONFLICT],
            [HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICE_UNAVAILABLE],
      ])('ánh xạ HTTP %i sang %s', (httpStatus, expectedCode) => {
            const { host, json } = createHost();

            new AllExceptionsFilter().catch(new HttpException('lỗi', httpStatus), host);

            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: expectedCode }) }));
      });

      test('lỗi nghiệp vụ giữ nguyên thông báo và chi tiết của chính nó', () => {
            const { host, json } = createHost();
            const details = { reason: 'OUT_OF_STOCK', sku: 'TEE-SUNSET-BLK-S', availableQuantity: 0 };

            new AllExceptionsFilter().catch(new DomainException(HttpStatus.CONFLICT, 'Áo đã hết hàng', details), host);

            expect(json).toHaveBeenCalledWith({
                  success: false,
                  error: { code: ERROR_CODES.CONFLICT, message: 'Áo đã hết hàng', details },
            });
      });

      test('lỗi ngoài dự kiến trả 500 và không lộ nội dung lỗi gốc', () => {
            // Thông điệp lỗi gốc có thể chứa chi tiết SQL hoặc đường dẫn tệp.
            const { host, status, json } = createHost();

            new AllExceptionsFilter().catch(new Error('relation "orders" does not exist'), host);

            expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

            const body = JSON.stringify(json.mock.calls[0]?.[0]);

            expect(body).toContain(ERROR_CODES.INTERNAL_ERROR);
            expect(body).not.toContain('relation');
      });

      test('ghi log kèm ngăn xếp khi lỗi từ 500 trở lên', () => {
            const { host } = createHost();

            new AllExceptionsFilter().catch(new Error('hỏng'), host);

            expect(Logger.prototype.error).toHaveBeenCalled();
      });

      test('không ghi log lỗi cho tình huống nghiệp vụ đã biết', () => {
            const { host } = createHost();

            new AllExceptionsFilter().catch(new HttpException('không thấy', HttpStatus.NOT_FOUND), host);

            expect(Logger.prototype.error).not.toHaveBeenCalled();
      });

      test('trạng thái không có trong bảng ánh xạ rơi về INTERNAL_ERROR', () => {
            const { host, json } = createHost();

            new AllExceptionsFilter().catch(new HttpException('quá nhiều yêu cầu', HttpStatus.TOO_MANY_REQUESTS), host);

            expect(json).toHaveBeenCalledWith(
                  expect.objectContaining({ error: expect.objectContaining({ code: ERROR_CODES.INTERNAL_ERROR }) }),
            );
      });
});

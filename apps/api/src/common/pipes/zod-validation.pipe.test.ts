import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { DomainException } from '../errors/domain.exception.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
      recipientName: z.string().min(2),
      recipientPhone: z.string().regex(/^0\d{9}$/),
});

describe('ZodValidationPipe', () => {
      test('trả về dữ liệu đã phân tích khi hợp lệ', () => {
            const pipe = new ZodValidationPipe(schema);

            expect(pipe.transform({ recipientName: 'Nguyễn Văn A', recipientPhone: '0912345678' })).toEqual({
                  recipientName: 'Nguyễn Văn A',
                  recipientPhone: '0912345678',
            });
      });

      test('nêu đúng tên trường sai để giao diện đánh dấu được ô nhập', () => {
            const pipe = new ZodValidationPipe(schema);

            const failure = (() => {
                  try {
                        pipe.transform({ recipientName: 'A', recipientPhone: '123' });
                  } catch (error: unknown) {
                        return error;
                  }

                  return undefined;
            })();

            expect(failure).toBeInstanceOf(DomainException);
            expect((failure as DomainException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
            expect((failure as DomainException).details).toEqual({ fields: ['recipientName', 'recipientPhone'] });
      });

      test('không lộ thông điệp gốc của Zod ra client', () => {
            // Thông điệp mặc định của Zod là tiếng Anh và mô tả cấu trúc schema.
            const pipe = new ZodValidationPipe(schema);

            const failure = (() => {
                  try {
                        pipe.transform({});
                  } catch (error: unknown) {
                        return error as DomainException;
                  }

                  return undefined;
            })();

            expect(failure?.userMessage).toBe('Dữ liệu gửi lên không hợp lệ');
      });
});

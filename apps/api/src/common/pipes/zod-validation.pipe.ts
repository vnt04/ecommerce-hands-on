import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validate dữ liệu vào ở biên bằng Zod.
 *
 * Ném BadRequestException để exception filter ánh xạ sang mã VALIDATION_FAILED,
 * thay vì để lỗi của Zod rơi vào nhánh lỗi 500 và lộ cấu trúc schema ra ngoài.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
      constructor(private readonly schema: ZodType<T>) {}

      transform(value: unknown): T {
            const result = this.schema.safeParse(value);

            if (!result.success) {
                  throw new BadRequestException(result.error.issues.map((issue) => issue.path.join('.')).join(', '));
            }

            return result.data;
      }
}

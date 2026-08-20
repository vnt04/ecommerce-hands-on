import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { DomainException } from '../errors/domain.exception.js';

/**
 * Validate dữ liệu vào ở biên bằng Zod.
 *
 * Trả kèm danh sách tên trường sai, không trả thông điệp gốc của Zod: thông điệp
 * mặc định của Zod là tiếng Anh và mô tả cấu trúc schema. Giao diện tự quyết câu
 * chữ tiếng Việt cho từng trường, đúng nguyên tắc frontend phân nhánh theo mã và
 * dữ liệu máy đọc được chứ không theo thông điệp.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
      constructor(private readonly schema: ZodType<T>) {}

      transform(value: unknown): T {
            const result = this.schema.safeParse(value);

            if (!result.success) {
                  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];

                  throw new DomainException(HttpStatus.BAD_REQUEST, 'Dữ liệu gửi lên không hợp lệ', { fields });
            }

            return result.data;
      }
}

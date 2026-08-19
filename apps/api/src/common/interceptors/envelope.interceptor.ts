import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Meta, SuccessEnvelope } from '@shopflow/shared';
import { map, type Observable } from 'rxjs';

/** Hình dạng controller trả về khi endpoint có phân trang. */
type PaginatedResult = { items: unknown[]; meta: Meta };

function isPaginatedResult(value: unknown): value is PaginatedResult {
      return (
            typeof value === 'object' &&
            value !== null &&
            'items' in value &&
            'meta' in value &&
            Array.isArray((value as PaginatedResult).items)
      );
}

/**
 * Bọc mọi giá trị controller trả về vào envelope thành công.
 *
 * Controller chỉ trả dữ liệu thuần, không tự dựng vỏ bọc — làm vậy thì sớm muộn
 * cũng có endpoint quên, và frontend phải xử lý hai hình dạng dữ liệu khác nhau.
 *
 * Endpoint có phân trang trả về { items, meta }; interceptor tách hai phần đó ra
 * đúng vị trí trong envelope, để `data` luôn là dữ liệu thật chứ không phải một
 * lớp bọc trung gian mà client phải bóc thêm một lần nữa.
 */
@Injectable()
export class EnvelopeInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<unknown>> {
      intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<unknown>> {
            return next.handle().pipe(
                  map((value): SuccessEnvelope<unknown> => {
                        if (isPaginatedResult(value)) {
                              return { success: true, data: value.items, meta: value.meta };
                        }

                        return { success: true, data: value };
                  }),
            );
      }
}

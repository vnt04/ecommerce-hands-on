import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { SuccessEnvelope } from '@shopflow/shared';
import { map, type Observable } from 'rxjs';

/**
 * Bọc mọi giá trị controller trả về vào envelope thành công.
 *
 * Controller chỉ trả dữ liệu thuần, không tự dựng vỏ bọc — làm vậy thì sớm muộn
 * cũng có endpoint quên, và frontend phải xử lý hai hình dạng dữ liệu khác nhau.
 */
@Injectable()
export class EnvelopeInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
      intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
            return next.handle().pipe(map((data): SuccessEnvelope<T> => ({ success: true, data })));
      }
}

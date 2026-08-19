import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { EnvelopeInterceptor } from './envelope.interceptor.js';

function runInterceptor<T>(value: T): Promise<unknown> {
      const next = { handle: () => of(value) } as CallHandler<T>;

      return new Promise((resolve) => {
            new EnvelopeInterceptor<T>().intercept({} as ExecutionContext, next).subscribe(resolve);
      });
}

describe('EnvelopeInterceptor', () => {
      test('bọc dữ liệu vào envelope thành công', async () => {
            await expect(runInterceptor({ status: 'ok' })).resolves.toEqual({ success: true, data: { status: 'ok' } });
      });

      test('bọc cả mảng mà không làm phẳng', async () => {
            await expect(runInterceptor([1, 2])).resolves.toEqual({ success: true, data: [1, 2] });
      });

      test('bọc cả giá trị rỗng để hình dạng response luôn nhất quán', async () => {
            await expect(runInterceptor(undefined)).resolves.toEqual({ success: true, data: undefined });
      });

      test('tách items và meta của kết quả phân trang ra đúng vị trí', async () => {
            // Nếu không tách, client phải bóc thêm một lớp: data.items thay vì data.
            const meta = { page: 1, limit: 20, total: 2 };

            await expect(runInterceptor({ items: ['a', 'b'], meta })).resolves.toEqual({
                  success: true,
                  data: ['a', 'b'],
                  meta,
            });
      });

      test('không nhầm object thường có trường tên items thành kết quả phân trang', async () => {
            const value = { items: 'không phải mảng', meta: null };

            await expect(runInterceptor(value)).resolves.toEqual({ success: true, data: value });
      });
});

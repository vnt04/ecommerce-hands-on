import type { ReferenceObject, SchemaObject } from '@nestjs/swagger';
import { apiSchemaRegistry, refTo } from '@shopflow/shared';
import { z } from 'zod';

/**
 * Chuyển schema Zod sang schema OpenAPI 3.0 — đúng phiên bản mà @nestjs/swagger sinh ra.
 *
 * Dữ liệu vào phải dùng `io: 'input'`. Schema request có `.transform()` (chuỗi chữ số
 * sang bigint, `'true'` sang boolean) và Zod từ chối biểu diễn phép biến đổi ở chiều
 * ra. Chiều vào cũng chính là thứ cần tài liệu hoá: client gửi lên hình dạng trước
 * khi biến đổi.
 */
export function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output'): SchemaObject {
      return z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
}

/**
 * Schema mô tả dữ liệu trả về.
 *
 * Schema đã đặt tên thì trỏ tới `components.schemas` để tài liệu không lặp lại cùng
 * một định nghĩa ở hàng chục đường dẫn. Hình dạng chỉ dùng đúng một chỗ thì nhúng
 * thẳng, vì đặt tên cho nó chỉ làm danh sách thành phần dài thêm mà không ai tra tới.
 */
export function toResponseSchema(schema: z.ZodType): SchemaObject | ReferenceObject {
      return apiSchemaRegistry.has(schema) ? refTo(schema) : toOpenApiSchema(schema, 'output');
}

/** Tách một schema object thành từng thuộc tính, để mô tả tham số truy vấn. */
export function toQueryProperties(schema: z.ZodType): Array<{ name: string; required: boolean; schema: SchemaObject }> {
      const converted = toOpenApiSchema(schema, 'input');
      const required = new Set(converted.required ?? []);

      return Object.entries(converted.properties ?? {}).map(([name, property]) => ({
            name,
            required: required.has(name),
            schema: property as SchemaObject,
      }));
}

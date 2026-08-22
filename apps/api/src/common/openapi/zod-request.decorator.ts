import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import type { z } from 'zod';

import { toOpenApiSchema, toQueryProperties } from './zod-schema.js';

/** Mô tả thân yêu cầu từ chính schema mà `ZodValidationPipe` dùng để kiểm tra. */
export function ApiZodBody(schema: z.ZodType): MethodDecorator {
      return ApiBody({ schema: toOpenApiSchema(schema, 'input') });
}

/**
 * Mô tả tham số truy vấn từ schema kiểm tra dữ liệu vào.
 *
 * Tách schema thành từng tham số rời chứ không mô tả nguyên khối: tham số truy vấn
 * trong OpenAPI khai báo từng cái một, và chỉ khi khai báo rời thì trang tài liệu
 * mới dựng được ô nhập cho từng bộ lọc.
 */
export function ApiZodQuery(schema: z.ZodType): MethodDecorator & ClassDecorator {
      return applyDecorators(
            ...toQueryProperties(schema).map((parameter) =>
                  ApiQuery({ name: parameter.name, required: parameter.required, schema: parameter.schema }),
            ),
      );
}

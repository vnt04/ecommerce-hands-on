import { z } from 'zod';

const COMPONENT_PATH = '#/components/schemas/';

/**
 * Nơi đăng ký các schema tạo nên hợp đồng response, để `apps/api` sinh phần
 * `components.schemas` của tài liệu OpenAPI.
 *
 * Dùng registry riêng chứ không dùng `z.globalRegistry`: registry toàn cục còn
 * chứa cả schema chỉ mang mô tả hoặc ví dụ, mà những thứ đó không phải thành
 * phần của hợp đồng và không nên xuất hiện thành một mục riêng trong tài liệu.
 */
export const apiSchemaRegistry = z.registry<{ id: string }>();

/**
 * Đặt tên cho một schema response. Tên trở thành khoá trong `components.schemas`
 * và là chỗ mọi endpoint dùng lại schema đó trỏ tới, thay vì lặp lại định nghĩa.
 */
export function apiSchema<T extends z.ZodType>(id: string, schema: T): T {
      apiSchemaRegistry.add(schema, { id });

      return schema;
}

/**
 * Tham chiếu tới một schema đã đặt tên.
 *
 * Ném lỗi khi schema chưa đăng ký, và vì tài liệu được dựng lúc khởi động nên
 * lỗi đó lộ ra ngay khi chạy chứ không nằm im tới lúc ai đó mở trang docs.
 */
export function refTo(schema: z.ZodType): { $ref: string } {
      const meta = apiSchemaRegistry.get(schema);

      if (meta === undefined) {
            throw new Error('Schema chưa được đặt tên bằng apiSchema nên không tham chiếu được');
      }

      return { $ref: COMPONENT_PATH + meta.id };
}

/**
 * Toàn bộ schema đã đăng ký, ở dạng `components.schemas`.
 *
 * Bỏ `$id` mà Zod chèn vào từng mục: OpenAPI 3.0 không có từ khoá đó, và giữ lại
 * chỉ làm bộ sinh mã phía client hiểu sai.
 */
export function toComponentSchemas(): Record<string, Record<string, unknown>> {
      const { schemas } = z.toJSONSchema(apiSchemaRegistry, {
            target: 'openapi-3.0',
            uri: (id) => COMPONENT_PATH + id,
      });

      return Object.fromEntries(
            Object.entries(schemas).map(([id, schema]) => [
                  id,
                  Object.fromEntries(Object.entries(schema as Record<string, unknown>).filter(([key]) => key !== '$id')),
            ]),
      );
}

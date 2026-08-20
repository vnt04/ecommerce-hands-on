import { describe, expect, test } from 'vitest';

import { ACCEPTED_IMAGE_TYPES, detectImageFormat } from './image-type.js';

/** Dựng một buffer bắt đầu bằng những byte cho trước, phần còn lại là số 0. */
function bufferStartingWith(bytes: number[], length = 32): Buffer {
      const content = Buffer.alloc(length);
      Buffer.from(bytes).copy(content);

      return content;
}

const JPEG = bufferStartingWith([0xff, 0xd8, 0xff, 0xe0]);
const PNG = bufferStartingWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = bufferStartingWith([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

describe('detectImageFormat', () => {
      test('nhận ra JPEG', () => {
            expect(detectImageFormat(JPEG)).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' });
      });

      test('nhận ra PNG', () => {
            expect(detectImageFormat(PNG)).toEqual({ mimeType: 'image/png', extension: 'png' });
      });

      test('nhận ra WebP bất kể bốn byte độ dài là gì', () => {
            const other = bufferStartingWith([0x52, 0x49, 0x46, 0x46, 0xff, 0xff, 0xff, 0xff, 0x57, 0x45, 0x42, 0x50]);

            expect(detectImageFormat(WEBP)?.extension).toBe('webp');
            expect(detectImageFormat(other)?.extension).toBe('webp');
      });

      test('từ chối tệp thực thi ELF dù đặt tên là ảnh', () => {
            // Đây là lý do tồn tại của hàm này: phần mở rộng do người tải lên đặt.
            const elf = bufferStartingWith([0x7f, 0x45, 0x4c, 0x46]);

            expect(detectImageFormat(elf)).toBeUndefined();
      });

      test('từ chối tệp HTML, vốn là mầm mống XSS nếu được phục vụ lại', () => {
            expect(detectImageFormat(Buffer.from('<html><script>alert(1)</script>'))).toBeUndefined();
      });

      test('từ chối RIFF không phải WebP, ví dụ tệp WAV', () => {
            const wav = bufferStartingWith([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);

            expect(detectImageFormat(wav)).toBeUndefined();
      });

      test('từ chối tệp rỗng và tệp quá ngắn để nhận dạng', () => {
            expect(detectImageFormat(Buffer.alloc(0))).toBeUndefined();
            expect(detectImageFormat(Buffer.from([0xff, 0xd8]))).toBeUndefined();
      });

      test('danh sách kiểu chấp nhận được sinh từ chính bảng nhận dạng', () => {
            // Hai nơi khai báo riêng thì sớm muộn lệch nhau.
            expect(ACCEPTED_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
      });
});

/**
 * Nhận dạng kiểu ảnh bằng những byte đầu tệp.
 *
 * Không bao giờ tin phần mở rộng của tên tệp, và cũng không tin `Content-Type`
 * do client gửi: cả hai đều do người tải lên đặt. Một tệp thực thi đổi tên thành
 * `.jpg` vẫn là tệp thực thi, và nếu máy chủ phục vụ lại nó với kiểu ảnh thì
 * trình duyệt của người khác là nơi hậu quả xảy ra.
 *
 * Ba định dạng đủ cho ảnh sản phẩm. Thêm định dạng khác thì thêm ở đây, không
 * thêm ở tầng gọi.
 */
type ImageFormat = { mimeType: string; extension: string };

/** Chuỗi byte nhận dạng, đặt ở đầu tệp. `null` nghĩa là byte đó không cần khớp. */
type Signature = { bytes: Array<number | null>; format: ImageFormat };

const SIGNATURES: readonly Signature[] = [
      { bytes: [0xff, 0xd8, 0xff], format: { mimeType: 'image/jpeg', extension: 'jpg' } },
      { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], format: { mimeType: 'image/png', extension: 'png' } },
      // WebP: "RIFF" rồi bốn byte độ dài rồi "WEBP".
      {
            bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
            format: { mimeType: 'image/webp', extension: 'webp' },
      },
];

export function detectImageFormat(content: Buffer): ImageFormat | undefined {
      return SIGNATURES.find((signature) => signature.bytes.every((byte, index) => byte === null || content[index] === byte))?.format;
}

export const ACCEPTED_IMAGE_TYPES = SIGNATURES.map((signature) => signature.format.mimeType);

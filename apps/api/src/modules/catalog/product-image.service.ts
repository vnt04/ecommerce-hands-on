import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminProductImage } from '@shopflow/shared';

import { DomainException } from '../../common/errors/domain.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { detectImageFormat } from '../storage/domain/image-type.js';
import { StorageService } from '../storage/storage.service.js';

/** Trần dung lượng một ảnh. Ảnh sản phẩm chụp bằng điện thoại hiếm khi vượt qua. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type UploadImageInput = {
      productSlug: string;
      colorCode?: string;
      altText?: string;
      content: Buffer;
};

@Injectable()
export class ProductImageService {
      constructor(
            private readonly prisma: PrismaService,
            private readonly storage: StorageService,
      ) {}

      /**
       * Nhận một ảnh, kiểm tra nội dung, ghi lên kho rồi gắn vào thiết kế.
       *
       * Kiểm bằng byte đầu tệp chứ không bằng phần mở rộng hay `Content-Type`: cả
       * hai đều do người tải lên đặt. Ghi lên kho trước rồi mới ghi vào cơ sở dữ
       * liệu, để không bao giờ có hàng trỏ tới một tệp không tồn tại.
       */
      async upload(input: UploadImageInput): Promise<AdminProductImage> {
            if (input.content.length > MAX_IMAGE_BYTES) {
                  throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE, 'Ảnh vượt quá 5MB', {
                        reason: 'FILE_TOO_LARGE',
                        maxBytes: MAX_IMAGE_BYTES,
                  });
            }

            const format = detectImageFormat(input.content);

            if (format === undefined) {
                  throw new DomainException(HttpStatus.BAD_REQUEST, 'Tệp không phải ảnh JPEG, PNG hoặc WebP', {
                        reason: 'UNSUPPORTED_FILE_TYPE',
                  });
            }

            const product = await this.prisma.product.findUnique({
                  where: { slug: input.productSlug },
                  select: { id: true, designCode: true },
            });

            if (product === null) {
                  throw new NotFoundException('Không tìm thấy thiết kế');
            }

            const colorId = await this.resolveColorId(input.colorCode);

            const stored = await this.storage.put(
                  input.content,
                  format.mimeType,
                  format.extension,
                  // Gom theo mã thiết kế để duyệt kho ảnh bằng mắt vẫn hiểu được.
                  'products/' + product.designCode,
            );

            const image = await this.prisma.productImage.create({
                  data: {
                        productId: product.id,
                        colorId,
                        url: stored.url,
                        altText: input.altText,
                        sortOrder: await this.nextSortOrder(product.id),
                  },
                  select: { id: true, url: true, altText: true, color: { select: { code: true } } },
            });

            return {
                  id: image.id.toString(),
                  url: image.url,
                  altText: image.altText,
                  colorCode: image.color?.code ?? null,
            };
      }

      /**
       * Gỡ ảnh khỏi thiết kế và xoá tệp trên kho.
       *
       * Xoá hàng trước rồi mới xoá tệp: thứ tự ngược lại để lại một hàng trỏ tới
       * tệp đã mất nếu bước sau lỗi, và trang sản phẩm hiện ảnh vỡ.
       *
       * Ảnh không nằm trong đơn hàng nên xoá cứng ở đây không vi phạm R8. Dòng đơn
       * chép tên sản phẩm, màu và size dưới dạng chuỗi, không tham chiếu tới ảnh.
       */
      async remove(imageId: bigint): Promise<void> {
            const image = await this.prisma.productImage.findUnique({ where: { id: imageId }, select: { url: true } });

            if (image === null) {
                  throw new NotFoundException('Không tìm thấy ảnh');
            }

            await this.prisma.productImage.delete({ where: { id: imageId } });

            const key = this.storage.keyFromUrl(image.url);

            if (key !== undefined) {
                  await this.storage.remove(key);
            }
      }

      private async resolveColorId(colorCode: string | undefined): Promise<bigint | undefined> {
            if (colorCode === undefined) {
                  return undefined;
            }

            const color = await this.prisma.color.findUnique({ where: { code: colorCode }, select: { id: true } });

            if (color === null) {
                  throw new NotFoundException('Không tìm thấy màu ' + colorCode);
            }

            return color.id;
      }

      private async nextSortOrder(productId: bigint): Promise<number> {
            const last = await this.prisma.productImage.findFirst({
                  where: { productId },
                  orderBy: { sortOrder: 'desc' },
                  select: { sortOrder: true },
            });

            return (last?.sortOrder ?? -1) + 1;
      }
}

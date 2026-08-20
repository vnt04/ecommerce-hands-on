import {
      CreateBucketCommand,
      DeleteObjectCommand,
      HeadBucketCommand,
      PutBucketPolicyCommand,
      PutObjectCommand,
      S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { loadEnv } from '../../config/env.js';

/** Kết quả một lần tải lên: khoá trong kho và đường dẫn công khai. */
export type StoredObject = { key: string; url: string };

/**
 * Kho ảnh nói giao thức S3.
 *
 * Ở môi trường phát triển điểm cuối là MinIO, ở production là S3 thật. Không có
 * nhánh `if` nào phân biệt hai nơi: khác biệt duy nhất nằm ở cấu hình. Nhờ vậy
 * thứ chạy trên máy và thứ chạy trên production là cùng một đường mã.
 */
@Injectable()
export class StorageService implements OnModuleInit {
      private readonly logger = new Logger(StorageService.name);
      private readonly env = loadEnv();
      private readonly client: S3Client;

      constructor() {
            this.client = new S3Client({
                  region: this.env.S3_REGION,
                  endpoint: this.env.S3_ENDPOINT,
                  credentials: {
                        accessKeyId: this.env.S3_ACCESS_KEY_ID,
                        secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
                  },
                  /**
                   * MinIO định địa chỉ theo đường dẫn (`endpoint/bucket/key`), còn S3 mặc
                   * định dùng tên miền con. Bật cờ này khi có điểm cuối tự khai báo.
                   */
                  forcePathStyle: this.env.S3_ENDPOINT !== undefined,
            });
      }

      /**
       * Tạo bucket nếu chưa có, và mở quyền đọc công khai cho nó.
       *
       * Chỉ chạy khi bucket chưa tồn tại — nghĩa là ở môi trường phát triển. Ở
       * production bucket do Terraform dựng kèm chính sách của nó, và ứng dụng
       * không được phép tự nới quyền một bucket đã có.
       */
      async onModuleInit(): Promise<void> {
            try {
                  await this.client.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }));

                  return;
            } catch {
                  // Bucket chưa có, hoặc tài khoản không có quyền HeadBucket. Thử tạo.
            }

            try {
                  await this.client.send(new CreateBucketCommand({ Bucket: this.env.S3_BUCKET }));
                  await this.allowPublicRead();
                  this.logger.log('Đã tạo bucket ' + this.env.S3_BUCKET + ' và mở quyền đọc công khai');
            } catch (error: unknown) {
                  // Không chặn khởi động: bucket có thể đã tồn tại nhưng tài khoản không
                  // có quyền HeadBucket, và đó là cấu hình hợp lệ ở production.
                  this.logger.warn('Không dựng được bucket: ' + String(error));
            }
      }

      /**
       * Ảnh sản phẩm là nội dung công khai: trình duyệt của khách tải trực tiếp,
       * không đi qua API và không mang theo thông tin đăng nhập nào.
       *
       * Chỉ mở quyền `GetObject`. Quyền ghi vẫn cần khoá, nếu không bất kỳ ai cũng
       * đặt được tệp vào kho ảnh của cửa hàng.
       */
      private async allowPublicRead(): Promise<void> {
            await this.client.send(
                  new PutBucketPolicyCommand({
                        Bucket: this.env.S3_BUCKET,
                        Policy: JSON.stringify({
                              Version: '2012-10-17',
                              Statement: [
                                    {
                                          Effect: 'Allow',
                                          Principal: '*',
                                          Action: ['s3:GetObject'],
                                          Resource: ['arn:aws:s3:::' + this.env.S3_BUCKET + '/*'],
                                    },
                              ],
                        }),
                  }),
            );
      }

      /**
       * Ghi một tệp lên kho.
       *
       * Khoá do hệ thống sinh, không lấy từ tên tệp gốc: tên do người tải lên đặt
       * và có thể chứa đường dẫn tương đối, ký tự điều khiển, hoặc trùng với tệp
       * đang có.
       */
      async put(content: Buffer, contentType: string, extension: string, prefix: string): Promise<StoredObject> {
            const key = prefix + '/' + randomUUID() + '.' + extension;

            await this.client.send(
                  new PutObjectCommand({
                        Bucket: this.env.S3_BUCKET,
                        Key: key,
                        Body: content,
                        ContentType: contentType,
                        /**
                         * Ảnh sản phẩm là nội dung công khai. Ghi kiểu nội dung do ta xác định
                         * bằng byte đầu tệp, không phải kiểu client khai báo.
                         */
                        CacheControl: 'public, max-age=31536000, immutable',
                  }),
            );

            return { key, url: this.urlOf(key) };
      }

      async remove(key: string): Promise<void> {
            await this.client.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      }

      urlOf(key: string): string {
            return this.env.S3_PUBLIC_URL + '/' + this.env.S3_BUCKET + '/' + key;
      }

      /**
       * Đọc ngược khoá từ đường dẫn công khai.
       *
       * Cần khi gỡ ảnh: bảng `product_images` lưu đường dẫn đầy đủ, còn lệnh xoá
       * cần khoá. Trả về `undefined` nếu đường dẫn không thuộc kho của ta — ảnh
       * cũ có thể trỏ tới nơi khác, và xoá theo một khoá đoán được là nguy hiểm.
       */
      keyFromUrl(url: string): string | undefined {
            const prefix = this.env.S3_PUBLIC_URL + '/' + this.env.S3_BUCKET + '/';

            return url.startsWith(prefix) ? url.slice(prefix.length) : undefined;
      }
}

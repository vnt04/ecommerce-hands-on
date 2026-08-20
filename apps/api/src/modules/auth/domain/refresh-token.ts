import { createHash, randomBytes, randomUUID } from 'node:crypto';

const TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type IssuedRefreshToken = {
      /** Giá trị gửi cho client. Chỉ tồn tại ở đây, không bao giờ lưu lại. */
      token: string;
      /** Giá trị lưu vào database. */
      tokenHash: string;
      familyId: string;
      expiresAt: Date;
};

/**
 * Chỉ lưu chuỗi băm của refresh token, không lưu bản gốc.
 *
 * Refresh token là thứ dùng được ngay để lấy phiên mới, nên nó tương đương mật
 * khẩu. Lộ database không được đồng nghĩa với lộ toàn bộ phiên đang mở.
 *
 * Dùng SHA-256 chứ không phải bcrypt: token đã là chuỗi ngẫu nhiên 32 byte nên
 * không có gì để tấn công từ điển, và mỗi request refresh phải tra được nó bằng
 * một lần tìm theo khoá thay vì duyệt toàn bảng.
 */
export function hashRefreshToken(token: string): string {
      return createHash('sha256').update(token).digest('hex');
}

export function issueRefreshToken(familyId: string = randomUUID(), now: Date = new Date()): IssuedRefreshToken {
      const token = randomBytes(TOKEN_BYTES).toString('base64url');

      return {
            token,
            tokenHash: hashRefreshToken(token),
            familyId,
            expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * MILLISECONDS_PER_DAY),
      };
}

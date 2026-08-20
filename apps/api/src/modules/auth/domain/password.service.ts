import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

/**
 * bcrypt chỉ đọc 72 byte đầu của mật khẩu và bỏ lặng phần còn lại.
 *
 * Không chặn ở tầng kiểm tra dữ liệu vào thì hai mật khẩu dài khác nhau nhưng
 * trùng 72 byte đầu sẽ đăng nhập được cho nhau — và không có gì báo động.
 */
export const MAX_PASSWORD_BYTES = 72;

const COST_FACTOR = 12;

/**
 * Chuỗi băm của một mật khẩu không ai dùng, tạo sẵn lúc khởi động.
 *
 * Dùng khi email không tồn tại: vẫn chạy một lượt so khớp để thời gian phản hồi
 * không tiết lộ email nào có trong hệ thống. Thoát sớm nhanh hơn hẳn, và chênh
 * lệch đó đủ để dò danh sách khách hàng.
 */
const DUMMY_HASH = bcrypt.hashSync('mat-khau-khong-ai-dung', COST_FACTOR);

@Injectable()
export class PasswordService {
      async hash(plainPassword: string): Promise<string> {
            return bcrypt.hash(plainPassword, COST_FACTOR);
      }

      async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
            return bcrypt.compare(plainPassword, passwordHash);
      }

      /** Tiêu tốn thời gian tương đương một lượt so khớp thật. */
      async verifyAgainstDummy(plainPassword: string): Promise<void> {
            await bcrypt.compare(plainPassword, DUMMY_HASH);
      }
}

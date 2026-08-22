import { apiSchema } from '@shopflow/shared';
import { z } from 'zod';

/** Hồ sơ rút gọn trả cho client. Không bao giờ kèm mật khẩu băm hay thông tin phiên. */
export const publicUserSchema = apiSchema(
      'PublicUser',
      z.object({
            id: z.string().meta({ description: 'Định danh dạng chuỗi chữ số' }),
            email: z.string(),
            fullName: z.string(),
            role: z.enum(['CUSTOMER', 'ADMIN']),
      }),
);

export type PublicUser = z.infer<typeof publicUserSchema>;

export const sessionSchema = apiSchema(
      'Session',
      z.object({
            accessToken: z.string().meta({
                  description: 'Sống mười lăm phút. Refresh token nằm trong cookie httpOnly nên không có trong thân response',
            }),
            user: publicUserSchema,
      }),
);

export type SessionResponse = z.infer<typeof sessionSchema>;

export const accessTokenSchema = apiSchema('AccessToken', z.object({ accessToken: z.string() }));

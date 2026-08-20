import { describe, expect, test } from 'vitest';

import { hashRefreshToken, issueRefreshToken } from './refresh-token.js';

describe('hashRefreshToken', () => {
      test('cùng token cho cùng chuỗi băm, để tra được bằng một lần tìm theo khoá', () => {
            expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
      });

      test('token khác nhau cho chuỗi băm khác nhau', () => {
            expect(hashRefreshToken('abc')).not.toBe(hashRefreshToken('abd'));
      });

      test('chuỗi băm không chứa token gốc', () => {
            // Lộ database không được đồng nghĩa với lộ phiên đang mở.
            expect(hashRefreshToken('bi-mat')).not.toContain('bi-mat');
      });
});

describe('issueRefreshToken', () => {
      test('mỗi lần cấp cho một token khác nhau', () => {
            expect(issueRefreshToken().token).not.toBe(issueRefreshToken().token);
      });

      test('lưu chuỗi băm chứ không lưu token', () => {
            const issued = issueRefreshToken();

            expect(issued.tokenHash).toBe(hashRefreshToken(issued.token));
            expect(issued.tokenHash).not.toBe(issued.token);
      });

      test('giữ nguyên mã họ khi xoay vòng, để truy được cả phiên khi phát hiện dùng lại', () => {
            const first = issueRefreshToken();
            const rotated = issueRefreshToken(first.familyId);

            expect(rotated.familyId).toBe(first.familyId);
            expect(rotated.token).not.toBe(first.token);
      });

      test('sinh mã họ mới khi không truyền vào', () => {
            expect(issueRefreshToken().familyId).not.toBe(issueRefreshToken().familyId);
      });

      test('hạn dùng tính từ thời điểm cấp', () => {
            const now = new Date('2026-01-01T00:00:00Z');
            const issued = issueRefreshToken(undefined, now);

            expect(issued.expiresAt.getTime()).toBeGreaterThan(now.getTime());
      });
});

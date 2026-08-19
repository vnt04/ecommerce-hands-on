import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';

/**
 * Dựng một PostgreSQL thật cho cả bộ test tích hợp.
 *
 * Một container dùng chung cho toàn bộ lần chạy, không phải mỗi tệp một container:
 * khởi động container tốn vài giây, nhân với số tệp test thì không ai chạy test nữa.
 * Cô lập dữ liệu giữa các test do resetDatabase lo, xem test/database.ts.
 */
let container: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();

      const databaseUrl = container.getConnectionUri();
      process.env.DATABASE_URL = databaseUrl;

      // Dựng lược đồ bằng chính migration sẽ chạy trên production, không dùng db push.
      // Nhờ vậy test cũng là một lần kiểm chứng rằng migration áp dụng được từ đầu.
      execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
            env: { ...process.env, DATABASE_URL: databaseUrl },
            stdio: 'pipe',
      });
}

export async function teardown(): Promise<void> {
      await container?.stop();
}

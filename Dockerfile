# Ảnh production. Ảnh phát triển nằm ở Dockerfile.dev và khác hẳn về mục đích:
# bản đó bind mount mã nguồn và cài cả devDependencies, bản này tự chứa.
#
# Ba tầng: cài dependency, biên dịch, rồi chạy. Tầng cuối chỉ nhận kết quả biên
# dịch và dependency chạy thật, nên không mang theo trình biên dịch, mã nguồn
# TypeScript, hay bất cứ thứ gì chỉ cần lúc dựng.

# --- Tầng 1: cài toàn bộ dependency, gồm cả devDependencies để biên dịch ---
FROM node:22-alpine AS deps

ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Chỉ copy manifest trước để tầng cài đặt được cache lại khi mã nguồn đổi.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile


# --- Tầng 2: biên dịch shared rồi api ---
FROM deps AS build

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# prisma.config.ts đọc DATABASE_URL khi nạp, kể cả với lệnh generate vốn không
# kết nối database. Cấp một giá trị giả cho tầng dựng. Không có database nào
# được liên hệ, và biến này không tồn tại ở tầng chạy vì tầng đó dựng từ đầu.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build

# Sinh Prisma Client trước khi biên dịch: mã TypeScript nhập kiểu từ đó.
RUN pnpm --filter @shopflow/shared build \
    && pnpm --filter @shopflow/api exec prisma generate \
    && pnpm --filter @shopflow/api exec nest build

# Dựng một thư mục tự chứa chỉ có thứ api cần lúc chạy.
#
# `pnpm deploy` là công cụ dành riêng cho việc này trong workspace: nó gỡ hết
# symlink trỏ ra ngoài, chép `@shopflow/shared` vào bên trong, và bỏ
# devDependencies. Cách khác là chạy `pnpm install --prod` rồi chép cả
# `node_modules` của workspace, nhưng cách đó vẫn để lại toàn bộ kho ảo `.pnpm`
# — đã thử và ảnh vẫn mang theo vitest, typescript, eslint cùng 700MB.
#
# CI=true vì pnpm phải xoá thư mục đích và không có TTY để hỏi.
#
# --legacy vì workspace này không bật `inject-workspace-packages`; pnpm 10 đòi
# nêu rõ điều đó thay vì tự đoán.
#
# Không dùng --ignore-scripts ở đây: cờ đó chặn luôn bước tạo bin link, và
# `node_modules/.bin/prisma` là thứ lệnh migrate lúc triển khai gọi tới. Script
# `prepare` của gốc workspace không chạy vì lệnh này chỉ deploy một package con.
RUN CI=true pnpm deploy --filter=@shopflow/api --prod --legacy /deploy \
    && cd /deploy \
    && CI=true pnpm exec prisma generate


# --- Tầng 3: ảnh chạy ---
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

# Chạy dưới user không đặc quyền. `node` là user có sẵn trong ảnh chính thức của
# Node, uid 1000. Chạy dưới root nghĩa là một lỗ hổng trong ứng dụng trở thành
# quyền root trong container.
WORKDIR /app

COPY --from=build --chown=node:node /deploy ./

USER node

EXPOSE 3000

# Gọi thẳng node, không qua pnpm: pnpm sinh thêm một tiến trình trung gian và
# tiến trình đó nuốt tín hiệu, khiến container không dừng gọn khi được yêu cầu.
CMD ["node", "dist/main.js"]


# --- Tầng 4: dựng web tĩnh ---
FROM deps AS web-build

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Không truyền secret nào vào đây. Biến build của Vite đi thẳng vào tệp tải về
# máy khách, nên mọi giá trị ở bước này là công khai (ràng buộc R6).
RUN pnpm --filter @shopflow/shared build     && pnpm --filter @shopflow/web build


# --- Tầng 5: phục vụ web tĩnh ---
#
# Ở production tệp tĩnh nằm trên S3 sau CloudFront, và quy tắc trả `index.html`
# cho đường dẫn không khớp do CloudFront lo. Ảnh này để chạy đúng bộ production
# tại chỗ mà kiểm chứng: nginx thực thi cùng một quy tắc bằng `try_files`.
FROM nginx:1.29-alpine AS web

COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

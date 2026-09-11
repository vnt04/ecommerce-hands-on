-- ShopFlow / ecommerce SQL practice database generator (PostgreSQL 14+)
--
-- Run with psql against a database that you created yourself:
--   createdb ecommerce_practice
--   psql -v ON_ERROR_STOP=1 -d ecommerce_practice \
--     -f generate_ecommerce_practice.sql
--
-- Override individual sizes, for example:
--   psql -v ON_ERROR_STOP=1 -d ecommerce_practice \
--     -v users_count=1000000 -v orders_count=2000000 \
--     -v order_items_count=5000000 \
--     -f generate_ecommerce_practice.sql
--
-- IMPORTANT: this recreates (drops) only the `ecommerce_practice` schema.
-- Approximate default volume: 16.5 million fact rows. Disk usage depends on the
-- PostgreSQL version and settings, but allow at least 10-20 GB including indexes.

\set ECHO errors
\timing on

\if :{?users_count}
\else
  \set users_count 500000
\endif
\if :{?products_count}
\else
  \set products_count 500000
\endif
\if :{?variants_count}
\else
  \set variants_count 2000000
\endif
\if :{?images_count}
\else
  \set images_count 1000000
\endif
\if :{?tokens_count}
\else
  \set tokens_count 500000
\endif
\if :{?carts_count}
\else
  \set carts_count 500000
\endif
\if :{?cart_items_count}
\else
  \set cart_items_count 2000000
\endif
\if :{?orders_count}
\else
  \set orders_count 1000000
\endif
\if :{?order_items_count}
\else
  \set order_items_count 3000000
\endif
\if :{?history_count}
\else
  \set history_count 3000000
\endif
\if :{?idempotency_count}
\else
  \set idempotency_count 500000
\endif
\if :{?variant_changes_count}
\else
  \set variant_changes_count 2000000
\endif
\if :{?project_mode}
\else
  \set project_mode false
\endif
\if :{?confirm_reset}
\else
  \set confirm_reset false
\endif

\echo Creating schema and tables...
SET statement_timeout = 0;
SET lock_timeout = 0;
SET synchronous_commit = off;
SET maintenance_work_mem = '1GB';
SET work_mem = '128MB';

-- Each expression deliberately divides by zero when an invalid scale is passed.
SELECT 1 / CASE WHEN :users_count > 0 AND :products_count > 0
                     AND :variants_count > 0 AND :carts_count > 0
                     AND :orders_count > 0 THEN 1 ELSE 0 END
  AS validate_positive_core_counts;
SELECT 1 / CASE WHEN :variants_count::bigint <= :products_count::bigint * 800
                THEN 1 ELSE 0 END AS validate_variant_matrix_capacity;
SELECT 1 / CASE WHEN :cart_items_count::bigint <=
                     :carts_count::bigint * :variants_count::bigint
                THEN 1 ELSE 0 END AS validate_unique_cart_item_capacity;

\if :project_mode
  \if :confirm_reset
    \echo Project mode: clearing existing ShopFlow data in public schema...
  \else
    \echo ERROR: project_mode deletes existing ShopFlow data. Re-run with -v confirm_reset=true
    \quit
  \endif
  \set target_schema public
  SET search_path = public;
  TRUNCATE TABLE
    variant_changes, order_status_history, idempotency_keys,
    order_number_counters, order_items, orders, cart_items, carts,
    refresh_tokens, product_images, product_variants, products,
    users, sizes, colors, size_charts, categories
  RESTART IDENTITY CASCADE;
\else
  \set target_schema ecommerce_practice
  DROP SCHEMA IF EXISTS ecommerce_practice CASCADE;
  CREATE SCHEMA ecommerce_practice;
  SET search_path = ecommerce_practice, public;

CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE product_status AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('COD', 'GATEWAY');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE size_charts (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, measurements JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE colors (
  id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL,
  hex_code TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE sizes (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY, category_id BIGINT NOT NULL, design_code TEXT NOT NULL,
  slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT, material TEXT,
  care_guide TEXT, print_method TEXT, status product_status NOT NULL,
  archived_at TIMESTAMPTZ, size_chart_id BIGINT, created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE product_variants (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL, color_id BIGINT NOT NULL,
  size_id BIGINT NOT NULL, sku TEXT NOT NULL, price BIGINT NOT NULL,
  stock_quantity INTEGER NOT NULL, weight_grams INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE product_images (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL, color_id BIGINT,
  url TEXT NOT NULL, alt_text TEXT, sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL, role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE refresh_tokens (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, token_hash TEXT NOT NULL,
  family_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE carts (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT, token TEXT,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE cart_items (
  id BIGSERIAL PRIMARY KEY, cart_id BIGINT NOT NULL, variant_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL, price_when_added BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT, order_number TEXT NOT NULL,
  status order_status NOT NULL, payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL, recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL, address_line TEXT NOT NULL, ward TEXT NOT NULL,
  district TEXT NOT NULL, province TEXT NOT NULL, note TEXT,
  subtotal BIGINT NOT NULL DEFAULT 0, shipping_fee BIGINT NOT NULL,
  total BIGINT NOT NULL DEFAULT 0, placed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL, variant_id BIGINT,
  sku TEXT NOT NULL, product_name TEXT NOT NULL, product_slug TEXT NOT NULL,
  color_name TEXT NOT NULL, size_name TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_price BIGINT NOT NULL, line_total BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE order_number_counters (day DATE PRIMARY KEY, last_value INTEGER NOT NULL);
CREATE TABLE idempotency_keys (
  id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, user_id BIGINT, order_id BIGINT,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE order_status_history (
  id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL, from_status order_status,
  to_status order_status, payment_from_status payment_status,
  payment_to_status payment_status, changed_by_id BIGINT, note TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE variant_changes (
  id BIGSERIAL PRIMARY KEY, variant_id BIGINT NOT NULL, price_from BIGINT,
  price_to BIGINT, stock_delta INTEGER, stock_after INTEGER, reason TEXT,
  changed_by_id BIGINT, created_at TIMESTAMPTZ NOT NULL
);
\endif

\echo Loading lookup data...
INSERT INTO categories
SELECT g, 'category-' || g, 'Danh mục ' || g, g,
       now() - g * interval '1 day', now() - g * interval '1 day'
FROM generate_series(1, 200) g;

INSERT INTO size_charts
SELECT g, 'Bảng size ' || g,
       jsonb_build_object('S', jsonb_build_object('chest', 88 + g % 5, 'length', 64 + g % 4),
                          'M', jsonb_build_object('chest', 94 + g % 5, 'length', 67 + g % 4),
                          'L', jsonb_build_object('chest', 100 + g % 5, 'length', 70 + g % 4)),
       now() - g * interval '1 day'
FROM generate_series(1, 100) g;

INSERT INTO colors
SELECT g, 'C' || lpad(g::text, 3, '0'), 'Màu ' || g,
       '#' || substr(md5(g::text), 1, 6), now() - g * interval '1 day'
FROM generate_series(1, 100) g;

INSERT INTO sizes VALUES
  (1,'XS',1,now()), (2,'S',2,now()), (3,'M',3,now()), (4,'L',4,now()),
  (5,'XL',5,now()), (6,'2XL',6,now()), (7,'3XL',7,now()), (8,'Free size',8,now());

\echo Loading :products_count products...
INSERT INTO products
SELECT g, 1 + (g::bigint * 37 % 200), 'DES-' || lpad(g::text, 9, '0'),
       'san-pham-' || g,
       (ARRAY['Áo thun','Áo polo','Áo hoodie','Áo sơ mi','Váy','Quần jeans'])[1 + g % 6] || ' ' || g,
       'Sản phẩm thời trang số ' || g || ' dành cho dữ liệu luyện tập SQL.',
       (ARRAY['Cotton','Polyester','Linen','Denim'])[1 + g % 4],
       'Giặt máy ở nhiệt độ thấp',
       (ARRAY['Screen print','DTG','Embroidery'])[1 + g % 3],
       CASE WHEN g % 20 = 0 THEN 'DRAFT'::product_status ELSE 'PUBLISHED'::product_status END,
       CASE WHEN g % 100 = 0 THEN now() - (g % 365) * interval '1 day' END,
       1 + g % 100,
       now() - (g % 1825) * interval '1 day',
       now() - (g % 365) * interval '1 day'
FROM generate_series(1, :products_count) g;

\echo Loading :variants_count product variants...
INSERT INTO product_variants
SELECT g, 1 + (g - 1) % :products_count,
       1 + (((g - 1) / :products_count) / 8) % 100,
       1 + ((g - 1) / :products_count) % 8,
       'SKU-' || lpad(g::text, 10, '0'),
       (99000 + (g::bigint * 7919 % 140) * 5000)::bigint,
       (g::bigint * 17 % 301)::integer, (150 + g::bigint * 13 % 851)::integer,
       g % 50 <> 0, now() - (g % 1825) * interval '1 day',
       now() - (g % 365) * interval '1 day'
FROM generate_series(1, :variants_count) g;

\echo Loading :images_count product images...
INSERT INTO product_images
SELECT g, 1 + (g - 1) % :products_count,
       CASE WHEN g % 5 = 0 THEN NULL ELSE 1 + (g::bigint * 13 % 100) END,
       'https://images.example.test/products/' || g || '.webp',
       CASE WHEN g % 7 = 0 THEN NULL ELSE 'Ảnh sản phẩm ' || g END,
       (g % 6)::integer, now() - (g % 1825) * interval '1 day'
FROM generate_series(1, :images_count) g;

\echo Loading :users_count users...
INSERT INTO users
SELECT g, 'user' || g || '@example.test', 'practice-only-password-hash-' || md5(g::text),
       'Khách hàng ' || g,
       CASE WHEN g <= 100 THEN 'ADMIN'::user_role ELSE 'CUSTOMER'::user_role END,
       now() - (g % 1825) * interval '1 day', now() - (g % 365) * interval '1 day'
FROM generate_series(1, :users_count) g;

\echo Loading :tokens_count refresh tokens...
INSERT INTO refresh_tokens
SELECT g, 1 + (g - 1) % :users_count, md5('token-a-' || g) || md5('token-b-' || g),
       md5('family-' || (1 + (g - 1) % :users_count)),
       now() + ((g % 60) - 30) * interval '1 day',
       CASE WHEN g % 10 = 0 THEN now() - (g % 30) * interval '1 day' END,
       now() - (g % 90) * interval '1 day'
FROM generate_series(1, :tokens_count) g;

\echo Loading :carts_count carts and :cart_items_count cart items...
INSERT INTO carts
SELECT g, CASE WHEN g % 2 = 0 AND g / 2 <= :users_count THEN g / 2 END,
       CASE WHEN g % 2 = 1 OR g / 2 > :users_count
            THEN md5('cart-a-' || g) || md5('cart-b-' || g) END,
       now() + ((g % 120) - 60) * interval '1 day',
       now() - (g % 365) * interval '1 day', now() - (g % 30) * interval '1 day'
FROM generate_series(1, :carts_count) g;

INSERT INTO cart_items
SELECT g, 1 + (g - 1) % :carts_count,
       1 + (((g::bigint - 1) / :carts_count) +
            (1 + (g::bigint - 1) % :carts_count) * 7919) % :variants_count,
       1 + g % 4, (99000 + (g::bigint * 7919 % 140) * 5000)::bigint,
       now() - (g % 90) * interval '1 day', now() - (g % 30) * interval '1 day'
FROM generate_series(1, :cart_items_count) g;

\echo Loading :orders_count orders...
INSERT INTO orders
SELECT g, CASE WHEN g % 5 = 0 THEN NULL ELSE 1 + (g::bigint * 15485863 % :users_count) END,
       'SF-' || to_char((date '2021-01-01' + (g % 2070)::integer), 'YYMMDD') || '-' || lpad(g::text, 9, '0'),
       CASE WHEN g % 20 = 0 THEN 'CANCELLED'::order_status
            WHEN g % 10 < 6 THEN 'DELIVERED'::order_status
            WHEN g % 10 < 8 THEN 'SHIPPING'::order_status
            WHEN g % 10 = 8 THEN 'CONFIRMED'::order_status
            ELSE 'PENDING'::order_status END,
       CASE WHEN g % 4 = 0 THEN 'GATEWAY'::payment_method ELSE 'COD'::payment_method END,
       CASE WHEN g % 20 = 0 AND g % 4 = 0 THEN 'REFUNDED'::payment_status
            WHEN g % 10 < 8 THEN 'PAID'::payment_status ELSE 'UNPAID'::payment_status END,
       'Người nhận ' || g, '09' || lpad((g % 100000000)::text, 8, '0'),
       (1 + g % 999) || ' Đường số ' || (1 + g % 100), 'Phường ' || (1 + g % 20),
       'Quận ' || (1 + g % 12),
       (ARRAY['TP Hồ Chí Minh','Hà Nội','Đà Nẵng','Cần Thơ','Hải Phòng'])[1 + g % 5],
       CASE WHEN g % 8 = 0 THEN 'Giao giờ hành chính' END,
       0,
       CASE WHEN g % 4 = 0 THEN 0 ELSE (15000 + (g % 4) * 5000)::bigint END,
       CASE WHEN g % 4 = 0 THEN 0 ELSE (15000 + (g % 4) * 5000)::bigint END,
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day' + (g % 86400) * interval '1 second',
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day',
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day' + interval '2 days'
FROM generate_series(1, :orders_count) g;

\echo Loading :order_items_count order items...
INSERT INTO order_items
SELECT g, 1 + (g - 1) % :orders_count, v.id, v.sku, p.name, p.slug,
       c.name, s.name, 1 + g % 4, v.price, v.price * (1 + g % 4),
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day'
FROM generate_series(1, :order_items_count) g
JOIN product_variants v ON v.id = 1 + (g::bigint * 32452843 % :variants_count)
JOIN products p ON p.id = v.product_id
JOIN colors c ON c.id = v.color_id
JOIN sizes s ON s.id = v.size_id;

\echo Calculating order totals...
UPDATE orders o
SET subtotal = x.subtotal, total = x.subtotal + o.shipping_fee
FROM (SELECT order_id, sum(line_total)::bigint subtotal FROM order_items GROUP BY order_id) x
WHERE o.id = x.order_id;

INSERT INTO order_number_counters
SELECT placed_at::date, count(*)::integer FROM orders GROUP BY placed_at::date;

\echo Loading :idempotency_count idempotency keys...
INSERT INTO idempotency_keys
SELECT g, md5('idem-a-' || g) || md5('idem-b-' || g),
       CASE WHEN g % 5 = 0 THEN NULL ELSE 1 + (g::bigint * 15485863 % :users_count) END,
       CASE WHEN g % 20 = 0 THEN NULL ELSE 1 + (g - 1) % :orders_count END,
       now() + ((g % 60) - 30) * interval '1 day', now() - (g % 90) * interval '1 day'
FROM generate_series(1, :idempotency_count) g;

\echo Loading :history_count order status history rows...
INSERT INTO order_status_history
SELECT g, 1 + (g - 1) % :orders_count,
       CASE WHEN g % 4 <> 3 AND ((g - 1) / :orders_count) > 0
            THEN (ARRAY['PENDING','CONFIRMED','SHIPPING','DELIVERED'])[((g - 1) / :orders_count % 4)::integer + 1]::order_status END,
       CASE WHEN g % 4 <> 3
            THEN (ARRAY['PENDING','CONFIRMED','SHIPPING','DELIVERED'])[((g - 1) / :orders_count % 4)::integer + 1]::order_status END,
       CASE WHEN g % 4 = 3 THEN 'UNPAID'::payment_status END,
       CASE WHEN g % 4 = 3 THEN 'PAID'::payment_status END,
       CASE WHEN g % 11 = 0 THEN NULL ELSE 1 + g % LEAST(:users_count, 100) END,
       CASE WHEN g % 20 = 0 THEN 'Thay đổi tự động bởi hệ thống' END,
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day' + ((g - 1) / :orders_count) * interval '1 hour'
FROM generate_series(1, :history_count) g;

\echo Loading :variant_changes_count variant audit rows...
INSERT INTO variant_changes
SELECT g, 1 + (g::bigint * 32452843 % :variants_count),
       CASE WHEN g % 5 = 0 THEN (99000 + (g % 140) * 5000)::bigint END,
       CASE WHEN g % 5 = 0 THEN (104000 + (g % 140) * 5000)::bigint END,
       CASE WHEN g % 5 <> 0 THEN (CASE WHEN g % 3 = 0 THEN -1 ELSE 10 + g % 91 END)::integer END,
       CASE WHEN g % 5 <> 0 THEN (100 + g % 1000)::integer END,
       CASE WHEN g % 5 = 0 THEN 'Điều chỉnh giá' ELSE 'Nhập/xuất kho' END,
       CASE WHEN g % 13 = 0 THEN NULL ELSE 1 + g % LEAST(:users_count, 100) END,
       timestamptz '2021-01-01 00:00:00+07' + (g % 2070) * interval '1 day'
FROM generate_series(1, :variant_changes_count) g;

\echo Adding constraints and indexes (this is usually the slowest phase)...
\if :project_mode
  \echo Project mode: using indexes and constraints already supplied by Prisma migrations.
\else
CREATE UNIQUE INDEX categories_slug_key ON categories(slug);
CREATE UNIQUE INDEX size_charts_name_key ON size_charts(name);
CREATE UNIQUE INDEX colors_code_key ON colors(code);
CREATE UNIQUE INDEX colors_name_key ON colors(name);
CREATE UNIQUE INDEX sizes_name_key ON sizes(name);
CREATE UNIQUE INDEX products_design_code_key ON products(design_code);
CREATE UNIQUE INDEX products_slug_key ON products(slug);
CREATE INDEX products_category_id_status_idx ON products(category_id, status);
CREATE UNIQUE INDEX product_variants_sku_key ON product_variants(sku);
CREATE UNIQUE INDEX product_variants_product_color_size_key ON product_variants(product_id, color_id, size_id);
CREATE INDEX product_variants_product_id_idx ON product_variants(product_id);
CREATE INDEX product_images_product_color_idx ON product_images(product_id, color_id);
CREATE UNIQUE INDEX users_email_key ON users(email);
CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens(token_hash);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens(family_id);
CREATE UNIQUE INDEX carts_user_id_key ON carts(user_id);
CREATE UNIQUE INDEX carts_token_key ON carts(token);
CREATE INDEX carts_expires_at_idx ON carts(expires_at);
CREATE UNIQUE INDEX cart_items_cart_variant_key ON cart_items(cart_id, variant_id);
CREATE UNIQUE INDEX orders_order_number_key ON orders(order_number);
CREATE INDEX orders_user_placed_idx ON orders(user_id, placed_at);
CREATE INDEX orders_status_placed_idx ON orders(status, placed_at);
CREATE INDEX orders_recipient_phone_idx ON orders(recipient_phone);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE UNIQUE INDEX idempotency_keys_key_key ON idempotency_keys(key);
CREATE INDEX idempotency_keys_expires_at_idx ON idempotency_keys(expires_at);
CREATE INDEX order_status_history_order_created_idx ON order_status_history(order_id, created_at);
CREATE INDEX variant_changes_variant_created_idx ON variant_changes(variant_id, created_at);

ALTER TABLE products
  ADD FOREIGN KEY (category_id) REFERENCES categories(id),
  ADD FOREIGN KEY (size_chart_id) REFERENCES size_charts(id);
ALTER TABLE product_variants
  ADD FOREIGN KEY (product_id) REFERENCES products(id),
  ADD FOREIGN KEY (color_id) REFERENCES colors(id),
  ADD FOREIGN KEY (size_id) REFERENCES sizes(id),
  ADD CHECK (price >= 0 AND stock_quantity >= 0 AND weight_grams >= 0);
ALTER TABLE product_images
  ADD FOREIGN KEY (product_id) REFERENCES products(id),
  ADD FOREIGN KEY (color_id) REFERENCES colors(id);
ALTER TABLE refresh_tokens ADD FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE carts
  ADD FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CHECK (num_nonnulls(user_id, token) = 1);
ALTER TABLE cart_items
  ADD FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  ADD CHECK (quantity > 0);
ALTER TABLE orders
  ADD FOREIGN KEY (user_id) REFERENCES users(id),
  ADD CHECK (subtotal >= 0 AND shipping_fee >= 0 AND total = subtotal + shipping_fee);
ALTER TABLE order_items
  ADD FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  ADD CHECK (quantity > 0 AND unit_price >= 0 AND line_total = unit_price * quantity);
ALTER TABLE order_number_counters ADD CHECK (last_value > 0);
ALTER TABLE order_status_history
  ADD FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (changed_by_id) REFERENCES users(id),
  ADD CHECK ((to_status IS NOT NULL)::int + (payment_to_status IS NOT NULL)::int = 1),
  ADD CHECK ((from_status IS NULL OR to_status IS NOT NULL) AND
             (payment_from_status IS NULL OR payment_to_status IS NOT NULL));
ALTER TABLE variant_changes
  ADD FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  ADD FOREIGN KEY (changed_by_id) REFERENCES users(id),
  ADD CHECK ((price_to IS NOT NULL)::int + (stock_delta IS NOT NULL)::int = 1),
  ADD CHECK ((price_to IS NULL OR price_from IS NOT NULL) AND
             (stock_delta IS NULL OR stock_after IS NOT NULL)),
  ADD CHECK ((price_from IS NULL OR price_from >= 0) AND
             (price_to IS NULL OR price_to >= 0) AND
             (stock_after IS NULL OR stock_after >= 0) AND
             (stock_delta IS NULL OR stock_delta <> 0));
\endif

-- Make sequences safe for later INSERTs that omit id.
SELECT setval(pg_get_serial_sequence(format('%I.%I', :'target_schema', t), 'id'), max_id, true)
FROM (VALUES
  ('categories', 200::bigint), ('size_charts', 100), ('colors', 100), ('sizes', 8),
  ('products', :products_count), ('product_variants', :variants_count),
  ('product_images', :images_count), ('users', :users_count),
  ('refresh_tokens', :tokens_count), ('carts', :carts_count),
  ('cart_items', :cart_items_count), ('orders', :orders_count),
  ('order_items', :order_items_count), ('idempotency_keys', :idempotency_count),
  ('order_status_history', :history_count), ('variant_changes', :variant_changes_count)
) AS x(t, max_id);

ANALYZE;

\echo Done. Row counts:
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I',
         :'target_schema', table_name), false, true, '')))[1]::text::bigint AS rows
FROM information_schema.tables
WHERE table_schema = :'target_schema' AND table_type = 'BASE TABLE'
ORDER BY table_name;

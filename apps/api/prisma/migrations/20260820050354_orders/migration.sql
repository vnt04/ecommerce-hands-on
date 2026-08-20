-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('COD', 'GATEWAY');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateTable
CREATE TABLE "orders" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "order_number" TEXT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "payment_method" "payment_method" NOT NULL,
    "payment_status" "payment_status" NOT NULL DEFAULT 'UNPAID',
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "note" TEXT,
    "subtotal" BIGINT NOT NULL,
    "shipping_fee" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "variant_id" BIGINT,
    "sku" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_slug" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,
    "size_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "line_total" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_number_counters" (
    "day" DATE NOT NULL,
    "last_value" INTEGER NOT NULL,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" BIGINT,
    "order_id" BIGINT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_placed_at_idx" ON "orders"("user_id", "placed_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma khong dien dat duoc CHECK, nen cac rang buoc duoi day viet tay.
-- Sua lai lam do ma chay migrate dev thi phai kiem tra chung con nguyen.

-- Chot chan cuoi cung cua rang buoc R2. Ke ca khi ma tru ton co loi, co so du lieu
-- van tu choi ghi mot so am. Khong co dong nay thi mot loi logic bien thanh ban vuot ton.
ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_stock_not_negative" CHECK ("stock_quantity" >= 0);

-- Tien khong bao gio am (ADR-003).
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_amounts_not_negative"
    CHECK ("subtotal" >= 0 AND "shipping_fee" >= 0 AND "total" >= 0);

-- Tong phai bang tong hai thanh phan. Sai lech o day nghia la don hien mot so
-- ma khach khong the doi chieu duoc voi cac dong.
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_total_matches_parts" CHECK ("total" = "subtotal" + "shipping_fee");

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_line_total_matches"
    CHECK ("unit_price" >= 0 AND "line_total" = "unit_price" * "quantity");

-- Bo dem chi tang, khong bao gio quay ve.
ALTER TABLE "order_number_counters"
    ADD CONSTRAINT "order_number_counters_last_value_positive" CHECK ("last_value" > 0);

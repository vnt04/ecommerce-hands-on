-- CreateTable
CREATE TABLE "order_status_history" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status",
    "payment_from_status" "payment_status",
    "payment_to_status" "payment_status",
    "changed_by_id" BIGINT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_recipient_phone_idx" ON "orders"("recipient_phone");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma khong dien dat duoc CHECK, nen rang buoc duoi day viet tay.

-- Moi dong ghi dung mot thay doi: hoac trang thai don, hoac trang thai thanh toan.
-- Khong co rang buoc nay thi mot dong co the mang ca hai, hoac khong mang gi,
-- va lich su tro thanh thu khong doc duoc.
ALTER TABLE "order_status_history"
    ADD CONSTRAINT "order_status_history_exactly_one_kind"
    CHECK (("to_status" IS NOT NULL)::int + ("payment_to_status" IS NOT NULL)::int = 1);

-- Trang thai truoc phai cung loai voi trang thai sau.
ALTER TABLE "order_status_history"
    ADD CONSTRAINT "order_status_history_from_matches_kind"
    CHECK (
        ("from_status" IS NULL OR "to_status" IS NOT NULL)
        AND ("payment_from_status" IS NULL OR "payment_to_status" IS NOT NULL)
    );

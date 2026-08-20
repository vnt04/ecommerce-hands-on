-- CreateTable
CREATE TABLE "variant_changes" (
    "id" BIGSERIAL NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "price_from" BIGINT,
    "price_to" BIGINT,
    "stock_delta" INTEGER,
    "stock_after" INTEGER,
    "reason" TEXT,
    "changed_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "variant_changes_variant_id_created_at_idx" ON "variant_changes"("variant_id", "created_at");

-- AddForeignKey
ALTER TABLE "variant_changes" ADD CONSTRAINT "variant_changes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_changes" ADD CONSTRAINT "variant_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma khong dien dat duoc CHECK, nen cac rang buoc duoi day viet tay.

-- Moi dong ghi dung mot loai thay doi: hoac gia, hoac ton kho. Mot dong mang ca
-- hai, hoac khong mang gi, la mot dong lich su khong doc duoc.
ALTER TABLE "variant_changes"
    ADD CONSTRAINT "variant_changes_exactly_one_kind"
    CHECK (("price_to" IS NOT NULL)::int + ("stock_delta" IS NOT NULL)::int = 1);

-- Doi gia phai co ca hai dau; ghi ton kho phai co ca luong cong them lan ton sau.
ALTER TABLE "variant_changes"
    ADD CONSTRAINT "variant_changes_pairs_complete"
    CHECK (
        ("price_to" IS NULL OR "price_from" IS NOT NULL)
        AND ("stock_delta" IS NULL OR "stock_after" IS NOT NULL)
    );

-- Tien khong bao gio am (ADR-003), va ton sau thao tac cung vay.
ALTER TABLE "variant_changes"
    ADD CONSTRAINT "variant_changes_values_not_negative"
    CHECK (
        ("price_from" IS NULL OR "price_from" >= 0)
        AND ("price_to" IS NULL OR "price_to" >= 0)
        AND ("stock_after" IS NULL OR "stock_after" >= 0)
    );

-- Ghi ton kho ma luong cong them bang 0 la mot dong khong noi len dieu gi.
ALTER TABLE "variant_changes"
    ADD CONSTRAINT "variant_changes_delta_not_zero" CHECK ("stock_delta" IS NULL OR "stock_delta" <> 0);

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "category_id" BIGINT NOT NULL,
    "design_code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "material" TEXT,
    "care_guide" TEXT,
    "print_method" TEXT,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMPTZ(6),
    "size_chart_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "color_id" BIGINT NOT NULL,
    "size_id" BIGINT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "weight_grams" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "color_id" BIGINT,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_charts" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "measurements" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "size_charts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_design_code_key" ON "products"("design_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "colors_code_key" ON "colors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_name_key" ON "sizes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_color_id_size_id_key" ON "product_variants"("product_id", "color_id", "size_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_color_id_idx" ON "product_images"("product_id", "color_id");

-- CreateIndex
CREATE UNIQUE INDEX "size_charts_name_key" ON "size_charts"("name");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_size_chart_id_fkey" FOREIGN KEY ("size_chart_id") REFERENCES "size_charts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ràng buộc ở tầng database, không chỉ ở tầng ứng dụng.
--
-- Lý do: seed script, lệnh psql thủ công và mọi migration về sau đều đi thẳng vào
-- database mà không qua mã kiểm tra của ứng dụng. Ràng buộc đặt ở đây là ràng buộc
-- duy nhất không ai vòng qua được.
ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock_quantity" >= 0);

ALTER TABLE "product_variants"
      ADD CONSTRAINT "product_variants_weight_non_negative" CHECK ("weight_grams" >= 0);

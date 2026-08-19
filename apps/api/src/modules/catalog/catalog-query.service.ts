import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { vndToJson } from '@shopflow/shared';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { ProductListQuery } from './dto/product-query.schema.js';

export type ColorSummary = { code: string; name: string; hexCode: string };

export type ProductCard = {
      slug: string;
      name: string;
      minPrice: string;
      colors: ColorSummary[];
      inStock: boolean;
};

export type ProductListResult = {
      items: ProductCard[];
      meta: { page: number; limit: number; total: number };
};

export type ProductDetail = {
      slug: string;
      name: string;
      description: string | null;
      material: string | null;
      careGuide: string | null;
      printMethod: string | null;
      colors: Array<ColorSummary & { images: Array<{ url: string; altText: string | null }> }>;
      sizes: Array<{ name: string; sortOrder: number }>;
      variants: Array<{ sku: string; colorCode: string; sizeName: string; price: string; inStock: boolean }>;
      sizeChart: { name: string; measurements: unknown } | null;
};

type ProductCardRow = {
      slug: string;
      name: string;
      min_price: bigint;
      in_stock: boolean;
      colors: ColorSummary[];
};

@Injectable()
export class CatalogQueryService {
      constructor(private readonly prisma: PrismaService) {}

      /**
       * Danh sách thiết kế cho trang catalog.
       *
       * Cố ý viết bằng SQL thô thay vì dựng qua Prisma: cần gộp giá thấp nhất và
       * danh sách màu cho từng sản phẩm trong một truy vấn duy nhất. Cách dựng bằng
       * include sẽ kéo toàn bộ ma trận biến thể lên bộ nhớ — hai mươi thiết kế là
       * ba trăm dòng cho một màn hình chỉ cần năm trường.
       *
       * Tổng cộng đúng hai truy vấn cho mỗi lần gọi, không phụ thuộc số sản phẩm.
       */
      async listProducts(query: ProductListQuery): Promise<ProductListResult> {
            const offset = (query.page - 1) * query.limit;

            const color = query.color ?? null;
            const size = query.size ?? null;
            const minPrice = query.minPrice ?? null;
            const maxPrice = query.maxPrice ?? null;
            const inStockOnly = query.inStock ?? false;
            const search = query.q === undefined ? null : '%' + query.q + '%';

            // Lọc ở mức biến thể: một thiết kế lọt qua nếu có ít nhất một biến thể
            // đang bật thoả toàn bộ điều kiện.
            const matching = Prisma.sql`
                  SELECT DISTINCT p.id
                  FROM products p
                  JOIN product_variants v ON v.product_id = p.id AND v.is_active
                  JOIN colors c ON c.id = v.color_id
                  JOIN sizes s ON s.id = v.size_id
                  WHERE p.status = 'PUBLISHED'
                    AND p.archived_at IS NULL
                    AND (${color}::text IS NULL OR c.code = ${color}::text)
                    AND (${size}::text IS NULL OR s.name = ${size}::text)
                    AND (${minPrice}::bigint IS NULL OR v.price >= ${minPrice}::bigint)
                    AND (${maxPrice}::bigint IS NULL OR v.price <= ${maxPrice}::bigint)
                    AND (${inStockOnly}::boolean IS NOT TRUE OR v.stock_quantity > 0)
                    AND (${search}::text IS NULL OR immutable_unaccent(p.name) ILIKE immutable_unaccent(${search}::text))
            `;

            const [rows, totalRows] = await Promise.all([
                  this.prisma.$queryRaw<ProductCardRow[]>`
                        WITH matching AS (${matching})
                        SELECT
                              p.slug,
                              p.name,
                              MIN(v.price) AS min_price,
                              BOOL_OR(v.stock_quantity > 0) AS in_stock,
                              JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('code', c.code, 'name', c.name, 'hexCode', c.hex_code)) AS colors
                        FROM products p
                        JOIN matching m ON m.id = p.id
                        JOIN product_variants v ON v.product_id = p.id AND v.is_active
                        JOIN colors c ON c.id = v.color_id
                        GROUP BY p.id, p.slug, p.name
                        ORDER BY p.id
                        LIMIT ${query.limit} OFFSET ${offset}
                  `,
                  this.prisma.$queryRaw<Array<{ total: bigint }>>`
                        WITH matching AS (${matching})
                        SELECT COUNT(*)::bigint AS total FROM matching
                  `,
            ]);

            return {
                  items: rows.map((row) => ({
                        slug: row.slug,
                        name: row.name,
                        minPrice: vndToJson(row.min_price),
                        colors: row.colors,
                        inStock: row.in_stock,
                  })),
                  meta: {
                        page: query.page,
                        limit: query.limit,
                        total: Number(totalRows[0]?.total ?? 0n),
                  },
            };
      }

      /**
       * Toàn bộ dữ liệu dựng trang chi tiết trong một request.
       *
       * Trả về cả biến thể đã hết hàng: giao diện cần biết size nào tồn tại mà
       * không mua được, để hiển thị vô hiệu hoá thay vì ẩn đi (ràng buộc R9).
       * Lọc bỏ chúng ở đây thì giao diện không còn đủ dữ liệu để làm đúng.
       */
      async getProductBySlug(slug: string): Promise<ProductDetail> {
            const product = await this.prisma.product.findFirst({
                  where: { slug, status: 'PUBLISHED', archivedAt: null },
                  select: {
                        slug: true,
                        name: true,
                        description: true,
                        material: true,
                        careGuide: true,
                        printMethod: true,
                        sizeChart: { select: { name: true, measurements: true } },
                        images: {
                              orderBy: { sortOrder: 'asc' },
                              select: { url: true, altText: true, colorId: true },
                        },
                        variants: {
                              where: { isActive: true },
                              orderBy: [{ colorId: 'asc' }, { size: { sortOrder: 'asc' } }],
                              select: {
                                    sku: true,
                                    price: true,
                                    stockQuantity: true,
                                    color: { select: { id: true, code: true, name: true, hexCode: true } },
                                    size: { select: { name: true, sortOrder: true } },
                              },
                        },
                  },
            });

            if (product === null) {
                  throw new NotFoundException('Không tìm thấy sản phẩm: ' + slug);
            }

            const colors = new Map<bigint, ColorSummary & { images: Array<{ url: string; altText: string | null }> }>();
            const sizes = new Map<string, { name: string; sortOrder: number }>();

            for (const variant of product.variants) {
                  if (!colors.has(variant.color.id)) {
                        colors.set(variant.color.id, {
                              code: variant.color.code,
                              name: variant.color.name,
                              hexCode: variant.color.hexCode,
                              images: product.images
                                    .filter((image) => image.colorId === variant.color.id || image.colorId === null)
                                    .map((image) => ({ url: image.url, altText: image.altText })),
                        });
                  }

                  sizes.set(variant.size.name, variant.size);
            }

            return {
                  slug: product.slug,
                  name: product.name,
                  description: product.description,
                  material: product.material,
                  careGuide: product.careGuide,
                  printMethod: product.printMethod,
                  colors: [...colors.values()],
                  sizes: [...sizes.values()].sort((left, right) => left.sortOrder - right.sortOrder),
                  variants: product.variants.map((variant) => ({
                        sku: variant.sku,
                        colorCode: variant.color.code,
                        sizeName: variant.size.name,
                        price: vndToJson(variant.price),
                        inStock: variant.stockQuantity > 0,
                  })),
                  sizeChart: product.sizeChart,
            };
      }
}

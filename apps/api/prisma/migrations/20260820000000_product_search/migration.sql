-- Tìm kiếm theo tên thiết kế, bỏ qua dấu tiếng Việt.
-- Gõ "hoang hon" phải ra "Hoàng Hôn".

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() không được đánh dấu bất biến vì nó phụ thuộc vào một từ điển có thể
-- thay đổi. PostgreSQL từ chối dùng hàm không bất biến trong index, nên phải bọc
-- lại và chỉ định từ điển tường minh.
--
-- Điều này an toàn với điều kiện không ai sửa từ điển 'unaccent'. Sửa từ điển mà
-- không dựng lại index sẽ làm index sai lệch một cách âm thầm.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      STRICT
      PARALLEL SAFE
AS $$
      SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$;

-- Index theo biểu thức, không phải theo cột. Nhờ vậy không có cột dẫn xuất nào
-- phải giữ đồng bộ với cột gốc — không thể lệch dữ liệu, kể cả khi ai đó chạy
-- UPDATE thẳng trong psql.
--
-- GIN với gin_trgm_ops là loại index duy nhất tăng tốc được ILIKE '%...%'.
CREATE INDEX "products_name_unaccent_trgm_idx"
      ON "products"
      USING gin (immutable_unaccent("name") gin_trgm_ops);

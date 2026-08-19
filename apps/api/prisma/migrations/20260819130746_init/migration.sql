-- Migration đầu tiên, cố ý không tạo bảng nào.
--
-- Mục đích duy nhất là chứng minh đường ống migration chạy được từ đầu tới cuối
-- trước khi có bảng nghiệp vụ: sinh tệp, áp dụng lên database, ghi nhận vào bảng
-- _prisma_migrations. Bảng đầu tiên của domain xuất hiện ở bước S03.
--
-- Xem docs/steps/S02.md quyết định 7.
SELECT 1;

# --- PostgreSQL ---

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = local.name }
}

/**
 * Mật khẩu database do AWS sinh và xoay, không do người đặt.
 *
 * `manage_master_user_password` để RDS tự quản mật khẩu trong Secrets Manager.
 * Nhờ vậy mật khẩu không bao giờ xuất hiện trong tệp trạng thái Terraform, vốn
 * là nơi mọi giá trị `password` thường bị rò ra.
 */
resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "shopflow"
  username = "shopflow"

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false

  # Sao lưu và khôi phục thuộc S11. Bảy ngày là mức tối thiểu để có gì đó khôi
  # phục được ngay từ bây giờ, thay vì không có gì.
  backup_retention_period = 7
  backup_window           = "18:00-19:00"
  maintenance_window      = "Sun:19:30-Sun:20:30"

  # Không cho xoá nhầm database production. Mặc định của hai biến này giữ nguyên
  # hành vi đó; hạ xuống là một hành động tường minh, phải gõ ra lúc chạy lệnh.
  deletion_protection = var.deletion_protection
  skip_final_snapshot = var.skip_final_snapshot

  # Tên bản sao cuối gắn với môi trường, và bỏ trống khi không chụp: tên cố định
  # làm vòng dựng–xoá thứ hai hỏng vì tên đã tồn tại.
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name}-final"

  # Nâng cấp phiên bản nhỏ tự động, trong cửa sổ bảo trì đã nêu ở trên.
  auto_minor_version_upgrade = true

  tags = { Name = local.name }
}

# --- Redis ---

resource "aws_elasticache_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

/**
 * Redis ở đây chỉ giữ bộ đếm rate limit.
 *
 * Mất toàn bộ dữ liệu Redis nghĩa là bộ đếm về 0, không mất gì của khách. Vì vậy
 * một node, không sao lưu, không nhân bản — và ghi rõ điều đó ở đây để sau này
 * không ai vô tình dùng nó làm nơi lưu thứ không được phép mất.
 */
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = local.name
  description          = "Rate limit counters only. Safe to lose."

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.redis_node_type

  num_cache_clusters = 1
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.cache.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  # Không sao lưu: dữ liệu ở đây mất được.
  snapshot_retention_limit = 0

  tags = { Name = local.name }
}

# --- Kho ảnh sản phẩm ---

resource "aws_s3_bucket" "images" {
  bucket = "${local.name}-images"

  tags = { Name = "${local.name}-images" }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  # Chặn ACL công khai nhưng cho phép chính sách bucket: quyền đọc được mở
  # bằng một chính sách nêu rõ, không bằng ACL rải rác trên từng đối tượng.
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

# Ảnh sản phẩm là nội dung công khai: trình duyệt tải trực tiếp, không mang theo
# thông tin đăng nhập nào. Chỉ mở quyền đọc; quyền ghi vẫn cần khoá.
resource "aws_s3_bucket_policy" "images_public_read" {
  bucket = aws_s3_bucket.images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.images.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.images]
}

resource "aws_s3_bucket_versioning" "images" {
  bucket = aws_s3_bucket.images.id

  # Ảnh bị gỡ nhầm thì khôi phục được. Ảnh không nằm trong đơn hàng nên xoá
  # cứng được, nhưng "xoá được" không có nghĩa là "không bao giờ xoá nhầm".
  versioning_configuration {
    status = "Enabled"
  }
}

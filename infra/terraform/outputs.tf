output "web_url" {
  description = "Địa chỉ cửa hàng."
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "Địa chỉ API. Trình duyệt gọi qua CloudFront ở /api, đây là đường trực tiếp dùng khi xử lý sự cố."
  value       = "https://api.${var.domain_name}"
}

output "web_bucket" {
  description = "Bucket chứa web tĩnh. Quy trình triển khai đồng bộ thư mục dist lên đây."
  value       = aws_s3_bucket.web.bucket
}

output "images_bucket" {
  description = "Bucket chứa ảnh sản phẩm."
  value       = aws_s3_bucket.images.bucket
}

output "cloudfront_distribution_id" {
  description = "Dùng để xoá cache sau khi triển khai web."
  value       = aws_cloudfront_distribution.main.id
}

output "ecs_cluster" {
  description = "Tên cluster ECS."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service" {
  description = "Tên service api."
  value       = aws_ecs_service.api.name
}

output "migrate_task_definition" {
  description = "Task definition chạy migration. Quy trình triển khai gọi nó trước khi cập nhật service."
  value       = aws_ecs_task_definition.migrate.family
}

output "private_subnet_ids" {
  description = "Dùng khi chạy task một lần, ví dụ migration."
  value       = aws_subnet.private[*].id
}

output "api_security_group_id" {
  description = "Dùng khi chạy task một lần, ví dụ migration."
  value       = aws_security_group.api.id
}

output "database_secret_arn" {
  description = "Secret do RDS quản, chứa mật khẩu chủ. Dùng để dựng chuỗi kết nối ghi vào SSM."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "database_endpoint" {
  description = "Địa chỉ database. Không nằm trên Internet công khai."
  value       = aws_db_instance.main.address
}

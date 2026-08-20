/**
 * Secret ở production nằm trong SSM Parameter Store, kiểu SecureString.
 *
 * Terraform tạo tham số nhưng **không đặt giá trị thật**: giá trị do người vận
 * hành ghi vào bằng một lệnh riêng, và không bao giờ đi qua CI hay qua tệp trạng
 * thái Terraform. Xem infra/README.md, mục "Ghi secret".
 *
 * `lifecycle.ignore_changes` là thứ giữ cho lần `terraform apply` sau không ghi
 * đè giá trị thật bằng chỗ giữ chỗ này.
 */

locals {
  secret_prefix = "/shopflow/${var.environment}"
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "${local.secret_prefix}/JWT_SECRET"
  description = "Khoa ky access token. Doi khoa nay lam moi phien dang mo mat hieu luc."
  type        = "SecureString"
  value       = "CHUA-DAT-XEM-infra-README"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "database_url" {
  name        = "${local.secret_prefix}/DATABASE_URL"
  description = "Chuoi ket noi PostgreSQL, gom ca mat khau do RDS sinh."
  type        = "SecureString"
  value       = "CHUA-DAT-XEM-infra-README"

  lifecycle {
    ignore_changes = [value]
  }
}

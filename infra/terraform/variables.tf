variable "region" {
  description = "Vùng AWS. ap-southeast-1 là Singapore, gần Việt Nam nhất."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Tên môi trường, dùng làm hậu tố cho tài nguyên."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = <<-EOT
            Tên miền phục vụ cửa hàng, ví dụ shopflow.vn.

            Bắt buộc: chứng chỉ HTTPS của ACM xác thực qua bản ghi DNS, và không có
            tên miền thì không có HTTPS. Vùng lưu trữ DNS phải nằm trong Route 53
            của cùng tài khoản, xem biến hosted_zone_id.
      EOT
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone của domain_name. Terraform ghi bản ghi xác thực chứng chỉ và bản ghi trỏ tới CloudFront vào đây."
  type        = string
}

variable "api_image" {
  description = <<-EOT
            Ảnh container của api, kèm thẻ.

            Luôn nêu thẻ cụ thể, không dùng `latest`: quay lui là trỏ về thẻ cũ, và
            `latest` thì không có thẻ cũ nào để trỏ về.
      EOT
  type        = string

  validation {
    condition     = !endswith(var.api_image, ":latest")
    error_message = "Không dùng thẻ latest. Nêu thẻ cụ thể để còn quay lui được."
  }
}

variable "vpc_cidr" {
  description = "Dải địa chỉ của VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "db_instance_class" {
  description = "Cỡ máy RDS. db.t4g.micro là cỡ nhỏ nhất còn nằm trong dòng hiện hành."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Dung lượng đĩa RDS, đơn vị GB. RDS không cho giảm sau khi đã tăng."
  type        = number
  default     = 20
}

variable "redis_node_type" {
  description = "Cỡ node ElastiCache. Redis ở đây chỉ đếm rate limit nên không cần lớn."
  type        = string
  default     = "cache.t4g.micro"
}

variable "api_cpu" {
  description = "CPU cho một task Fargate, đơn vị 1/1024 vCPU."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Bộ nhớ cho một task Fargate, đơn vị MB."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = <<-EOT
            Số bản sao api.

            Hai bản là mức tối thiểu để triển khai không có khoảng gián đoạn, và để
            một vùng khả dụng hỏng thì cửa hàng vẫn mở.
      EOT
  type        = number
  default     = 2
}

variable "log_retention_days" {
  description = "Số ngày giữ log trong CloudWatch. Giữ vô hạn là một khoản tiền tăng đều mà không ai để ý."
  type        = number
  default     = 30
}

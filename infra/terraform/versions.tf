terraform {
  required_version = "~> 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Trạng thái Terraform chứa mọi thứ đã dựng, kể cả giá trị nhạy cảm. Để nó
  # trên máy cá nhân nghĩa là mất máy là mất khả năng vận hành hạ tầng, và hai
  # người chạy cùng lúc thì ghi đè lên nhau.
  #
  # Bucket và bảng khoá phải tồn tại trước khi `terraform init` chạy lần đầu.
  # Xem infra/README.md, mục "Khởi tạo lần đầu".
  backend "s3" {
    key          = "shopflow/prod/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "shopflow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront chỉ nhận chứng chỉ ACM cấp ở us-east-1, bất kể hạ tầng nằm ở vùng nào.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "shopflow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# --- Chứng chỉ ---
#
# CloudFront chỉ nhận chứng chỉ cấp ở us-east-1, còn ALB cần chứng chỉ cùng vùng
# với chính nó. Hai chứng chỉ cho cùng một tên miền, cấp ở hai vùng khác nhau.

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "alb" {
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Bản ghi xác thực. ACM chờ bản ghi này xuất hiện rồi mới cấp chứng chỉ, nên phải
# để Terraform ghi nó thay vì làm tay — làm tay thì `apply` treo cho tới khi có ai
# nhớ ra.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for option in concat(
      tolist(aws_acm_certificate.cloudfront.domain_validation_options),
      tolist(aws_acm_certificate.alb.domain_validation_options),
    ) : option.domain_name => option
  }

  zone_id = var.hosted_zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn         = aws_acm_certificate.alb.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# --- Bucket chứa web tĩnh ---

resource "aws_s3_bucket" "web" {
  bucket = "${local.name}-web"

  tags = { Name = "${local.name}-web" }
}

# Bucket này không công khai. CloudFront đọc nó qua Origin Access Control, nên
# không ai đi vòng qua CDN để lấy thẳng từ S3.
resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name}-web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "web_from_cloudfront" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_from_cloudfront.json
}

# --- CloudFront ---

locals {
  web_origin_id    = "web"
  api_origin_id    = "api"
  images_origin_id = "images"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_200" # Gồm châu Á, bỏ Nam Mỹ và châu Phi.

  origin {
    origin_id                = local.web_origin_id
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id   = local.images_origin_id
    domain_name = aws_s3_bucket.images.bucket_regional_domain_name
  }

  origin {
    origin_id   = local.api_origin_id
    domain_name = aws_lb.main.dns_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.web_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # CachingOptimized: chính sách quản trị sẵn có của AWS.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = local.api_origin_id
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    # CachingDisabled và AllViewerExceptHostHeader: chính sách quản trị sẵn có.
    # Không cache lời gọi API, và chuyển tiếp nguyên cookie cùng header
    # Authorization — thiếu chúng là mọi endpoint cần đăng nhập đều hỏng.
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  ordered_cache_behavior {
    path_pattern           = "/anh/*"
    target_origin_id       = local.images_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  /**
       * Đây là chỗ giải quyết việc mở thẳng một đường dẫn sâu của ứng dụng.
       *
       * S3 trả 403 hoặc 404 cho khoá không tồn tại. Không có hai quy tắc dưới đây
       * thì mở thẳng /don-hang/SF-260819-0001 trả lỗi, dù đường dẫn đó hoạt động
       * khi bấm từ trong ứng dụng. Trả index.html kèm mã 200 để vue-router tự xử lý.
       */
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cloudfront.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = { Name = local.name }
}

# --- DNS ---

resource "aws_route53_record" "web" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = var.hosted_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

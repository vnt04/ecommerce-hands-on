# --- Quyền ---
#
# Hai vai trò tách bạch có chủ đích. Vai trò thực thi là quyền của hạ tầng ECS
# lúc dựng container: kéo ảnh, đọc secret, ghi log. Vai trò task là quyền của
# chính ứng dụng lúc chạy. Gộp hai thứ nghĩa là ứng dụng có luôn quyền đọc mọi
# secret của hệ thống, kể cả những thứ nó không bao giờ dùng tới.

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "read_secrets" {
  statement {
    actions = ["ssm:GetParameters"]

    # Chỉ những tham số của chính môi trường này, không phải toàn bộ kho.
    resources = [
      aws_ssm_parameter.jwt_secret.arn,
      aws_ssm_parameter.database_url.arn,
      aws_ssm_parameter.swagger_user.arn,
      aws_ssm_parameter.swagger_password.arn,
    ]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.read_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "task_images" {
  # Ứng dụng ghi và xoá ảnh sản phẩm. Không có quyền trên bucket nào khác, và
  # không có quyền đổi chính sách của chính bucket này.
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.images.arn}/*"]
  }
}

resource "aws_iam_role_policy" "task_images" {
  name   = "product-images"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_images.json
}

# --- Log ---

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}-api"
  retention_in_days = var.log_retention_days
}

# --- Cân bằng tải ---

resource "aws_lb" "main" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Bật để `terraform destroy` không bị chặn ở đây trong lúc thử nghiệm. Với
  # database thì ngược lại: deletion_protection bật, xem data-stores.tf.
  enable_deletion_protection = false

  tags = { Name = local.name }
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    # /healthz không chạm database có chủ đích: nếu nó phụ thuộc database
    # thì một sự cố database biến thành mọi task bị giết và thay mới, và
    # cửa hàng mất luôn cả những trang không cần database.
    path                = "/api/v1/healthz"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  # Chờ kết nối đang dở hoàn tất trước khi rút task cũ ra. Ba mươi giây đủ cho
  # một request đặt hàng chạy xong.
  deregistration_delay = 30
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.alb.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# --- ECS ---

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

locals {
  api_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "LOG_LEVEL", value = "info" },
    { name = "REDIS_URL", value = "redis://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379" },
    { name = "S3_REGION", value = var.region },
    { name = "S3_BUCKET", value = aws_s3_bucket.images.bucket },
    { name = "S3_PUBLIC_URL", value = "https://${aws_cloudfront_distribution.main.domain_name}/anh" },
    # S3_ENDPOINT bỏ trống: dùng điểm cuối mặc định của AWS theo vùng.
    # S3_ACCESS_KEY_ID và S3_SECRET_ACCESS_KEY cũng bỏ trống: task lấy
    # quyền từ IAM role, xem aws_iam_role.task.
  ]
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true

    portMappings = [{ containerPort = 3000, protocol = "tcp" }]

    environment = local.api_environment

    # Giá trị nhạy cảm đi đường riêng: ECS đọc từ SSM lúc dựng container.
    # Chúng không nằm trong task definition, nên `describe-task-definition`
    # không lộ ra gì.
    secrets = [
      { name = "JWT_SECRET", valueFrom = aws_ssm_parameter.jwt_secret.arn },
      { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
      { name = "SWAGGER_USER", valueFrom = aws_ssm_parameter.swagger_user.arn },
      { name = "SWAGGER_PASSWORD", valueFrom = aws_ssm_parameter.swagger_password.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

/**
 * Task chạy migration.
 *
 * Cùng ảnh với api, chỉ khác câu lệnh. Nhờ vậy bản migration luôn khớp với bản
 * mã sắp chạy — chạy migration từ một nơi khác là mời gọi hai bên lệch nhau.
 *
 * Không phải service: nó chạy một lần rồi thoát. Quy trình triển khai gọi nó
 * bằng `aws ecs run-task` và chờ xong mới cập nhật service, xem infra/README.md.
 */
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = var.api_image
    essential = true
    command   = ["./node_modules/.bin/prisma", "migrate", "deploy"]

    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "migrate"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  # Dựng bản mới trước, rút bản cũ sau. 100 phần trăm nghĩa là luôn còn đủ số
  # bản sao đang phục vụ trong lúc chuyển đổi.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Tự quay lui khi bản mới không lành mạnh, thay vì để nó vật vã mãi.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Bỏ qua nếu ai đó đổi số bản sao bằng tay lúc xử lý sự cố; Terraform không
  # kéo ngược về ở lần apply sau.
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.https]
}

# Langfuse (self-hosted) — the LLM observability backend
# `packages/telemetry/src/tracing.ts`'s own header already commits this codebase to:
# every OTel span this repo emits targets exactly one OTLP endpoint, Langfuse's own
# `/api/public/otel`, and this module is what makes that endpoint real in staging and
# production the same way `infra/docker/compose.dev.yml`'s own `langfuse-*` services
# already make it real in dev — same image versions, same "own dedicated Postgres/
# Redis/ClickHouse, only the object store's namespacing is shared-safe" shape that
# file's own header explains, not reinvented here.
#
# Unlike gateway/worker/web, Langfuse's own images are third-party — this repo's CD
# pipeline (.github/workflows/cd.yml) never builds or pushes them, so this module does
# not reuse modules/ecs-service (which always provisions its own ECR repository and
# expects to own what's pushed to it). langfuse-web/langfuse-worker below pull directly
# from docker.langfuse.com; a version bump is a deliberate `var.image_tag` change and
# `terraform apply`, not a CD-pipeline deploy.

data "aws_region" "current" {}

# --- Security groups for the two ECS services ------------------------------------------

resource "aws_security_group" "web" {
  name        = "${var.name}-web"
  description = "langfuse-web Fargate tasks."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-web" })
}

resource "aws_security_group" "worker" {
  name        = "${var.name}-worker"
  description = "langfuse-worker Fargate tasks."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-worker" })
}

resource "aws_security_group_rule" "web_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.web.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "worker_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.worker.id
  cidr_blocks       = ["0.0.0.0/0"]
}

# --- ALB — dedicated to Langfuse. Host-based routing on the main app's own shared ALB
# needs a real domain to route on; giving this its own ALB keeps this module working
# identically whether or not one exists yet, the same reasoning modules/stack's own
# domain_name = null fallback already uses. -------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Public ALB for Langfuse's own UI/API — inbound 80/443 from the internet, nothing else reaches it directly."
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.domain_name == null ? [] : [1]
    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-alb" })
}

resource "aws_security_group_rule" "web_from_alb" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.web.id
  source_security_group_id = aws_security_group.alb.id
}

resource "aws_lb" "this" {
  name               = var.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = var.tags
}

resource "aws_lb_target_group" "web" {
  name        = "${var.name}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/public/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
  }

  tags = var.tags
}

resource "aws_acm_certificate" "this" {
  count = var.domain_name == null ? 0 : 1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.domain_name == null ? {} : {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = var.dns_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count = var.domain_name == null ? 0 : 1

  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = var.domain_name == null ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.web.arn
    }
  }

  dynamic "default_action" {
    for_each = var.domain_name == null ? [] : [1]
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.domain_name == null ? 0 : 1

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.this[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_route53_record" "web" {
  count = var.domain_name == null ? 0 : 1

  zone_id = var.dns_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

locals {
  web_url = var.domain_name == null ? "http://${aws_lb.this.dns_name}" : "https://${var.domain_name}"
}

# --- Data plane: ClickHouse (EC2+EBS, see modules/clickhouse's own header), Postgres
# (RDS, reused as-is with no app roles — this instance is dedicated to Langfuse, which
# manages its own schema, so it connects as the RDS-managed master user directly rather
# than through the migrator/app_rw split every other consumer of modules/database
# uses), Redis (ElastiCache, reused as-is), S3 (reused as-is, a second bucket). --------

module "clickhouse" {
  source = "../clickhouse"

  name                       = "${var.name}-ch"
  vpc_id                     = var.vpc_id
  private_subnet_id          = var.clickhouse_subnet_id
  instance_type              = var.clickhouse_instance_type
  volume_size_gb             = var.clickhouse_volume_size_gb
  allowed_security_group_ids = [aws_security_group.web.id, aws_security_group.worker.id]

  tags = var.tags
}

module "database" {
  source = "../database"

  name                       = "${var.name}-db"
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.web.id, aws_security_group.worker.id]

  instance_class        = var.db_instance_class
  allocated_storage_gb  = var.db_allocated_storage_gb
  multi_az              = var.db_multi_az
  backup_retention_days = var.db_backup_retention_days
  deletion_protection   = var.db_deletion_protection

  # Langfuse manages its own schema/migrations against one connection — no
  # migrator/app_rw/worker_rw/analytics_ro split to generate roles for.
  app_role_names = []

  tags = var.tags
}

# modules/database always creates the RDS-managed master-user secret as separate fields
# (username/password/host/port/dbname — AWS's own shape), never a pre-built connection
# string; Langfuse's own DATABASE_URL needs one. Read the master secret's current value
# and derive a real connection-string secret from it, rather than inventing a second
# password path. manage_master_user_password does not enable automatic rotation on its
# own (this module attaches no rotation schedule) — only a human manually rotating the
# master password in the console would make this derived secret stale, the same
# "deliberate, coordinated action, not something a stray apply should silently handle"
# reasoning modules/cache's own auth_token already documents; re-running `terraform
# apply` after a manual rotation re-derives this secret from the new value.
data "aws_secretsmanager_secret_version" "db_master" {
  secret_id = module.database.master_user_secret_arn
}

locals {
  db_master             = jsondecode(data.aws_secretsmanager_secret_version.db_master.secret_string)
  langfuse_database_url = "postgresql://${local.db_master.username}:${local.db_master.password}@${module.database.endpoint}:${module.database.port}/${module.database.db_name}"
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.name}/db/url"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = jsonencode({ url = local.langfuse_database_url })
}

module "cache" {
  source = "../cache"

  name                       = "${var.name}-cache"
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.web.id, aws_security_group.worker.id]

  node_type = var.cache_node_type
  multi_az  = var.cache_multi_az

  tags = var.tags
}

module "object_store" {
  source = "../object-store"

  name = "${var.name}-objects"
  tags = var.tags
}

# --- OTLP credentials gateway/worker (the main app's own services) authenticate to
# Langfuse with. Generated here, not by a human clicking "create API key" in the
# Langfuse UI, so the same LANGFUSE_INIT_PROJECT_* values that bootstrap the project
# below are exactly what modules/stack wires into OTEL_EXPORTER_OTLP_HEADERS — one
# value, two places, the same shape KEYCLOAK_WEB_CLIENT_SECRET already has in
# infra/docker/.env.example. -----------------------------------------------------------

resource "random_id" "otlp_public_key" {
  byte_length = 16
}

resource "random_password" "otlp_secret_key" {
  length  = 40
  special = false
}

locals {
  otlp_public_key = "pk-lf-${random_id.otlp_public_key.hex}"
  otlp_secret_key = "sk-lf-${random_password.otlp_secret_key.result}"
  otlp_endpoint   = "${local.web_url}/api/public/otel"
  otlp_header     = "Authorization=Basic ${base64encode("${local.otlp_public_key}:${local.otlp_secret_key}")}"
}

resource "aws_secretsmanager_secret" "otlp" {
  name                    = "${var.name}/otlp"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "otlp" {
  secret_id = aws_secretsmanager_secret.otlp.id
  secret_string = jsonencode({
    header     = local.otlp_header
    public_key = local.otlp_public_key
    secret_key = local.otlp_secret_key
  })
}

# --- Other credentials (SALT, ENCRYPTION_KEY, NEXTAUTH_SECRET — Langfuse's own,
# infra/docker/compose.dev.yml's dev bootstrap already names what each is for) --------

resource "random_password" "salt" {
  length  = 32
  special = false
}

resource "random_id" "encryption_key" {
  byte_length = 32 # 64 hex characters — Langfuse's own required ENCRYPTION_KEY length
}

resource "random_password" "nextauth_secret" {
  length  = 44
  special = false
}

resource "random_password" "init_user_password" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    salt               = random_password.salt.result
    encryption_key     = random_id.encryption_key.hex
    nextauth_secret    = random_password.nextauth_secret.result
    init_user_password = random_password.init_user_password.result
  })
}

# --- ECS: log groups, execution/task roles, task definitions, services --------------
# Shaped like modules/ecs-service (same health-check/logging/autoscaling conventions),
# but not that module — see this file's own header for why (external image, no ECR).

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.name}-web"
  retention_in_days = 30

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name}-worker"
  retention_in_days = 30

  tags = var.tags
}

data "aws_iam_policy_document" "assume_ecs_task" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.assume_ecs_task.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

locals {
  # Every secret ARN a task's execution role needs read access to, across all four
  # Secrets Manager secrets this module creates/reuses — the same "truncate to the base
  # ARN, ECS's own ':json-key::' suffix stripped" reasoning modules/ecs-service's own
  # execution_secrets local already documents.
  secret_base_arns = distinct([
    for arn in [
      module.clickhouse.credentials_secret_arn,
      aws_secretsmanager_secret.database_url.arn,
      module.cache.redis_url_secret_arn,
      aws_secretsmanager_secret.otlp.arn,
      aws_secretsmanager_secret.app.arn,
    ] : join(":", slice(split(":", arn), 0, 7))
  ])
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secret_base_arns
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${var.name}-read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-task"
  assume_role_policy = data.aws_iam_policy_document.assume_ecs_task.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_object_store" {
  role       = aws_iam_role.task.name
  policy_arn = module.object_store.read_write_policy_arn
}

locals {
  # Every field the reference infra/docker/compose.dev.yml langfuse-worker/langfuse-web
  # share (the "&langfuse-env" anchor there) — env for plain values, secrets for
  # anything Secrets Manager holds. langfuse-web's own container_definitions below adds
  # the handful only it needs (NEXTAUTH_SECRET, the LANGFUSE_INIT_* bootstrap).
  #
  # No LANGFUSE_S3_*_ACCESS_KEY_ID/SECRET_ACCESS_KEY: unlike infra/docker/compose.dev.yml's
  # MinIO (which has no IAM concept and requires an explicit static key pair), real S3
  # access here goes through the task role (aws_iam_role_policy_attachment.task_object_store
  # below), the same "no explicit key, the AWS SDK's default credential chain picks up the
  # task's own role" pattern apps/gateway and apps/worker's own OBJECT_STORE_ENDPOINT/
  # OBJECT_STORE_BUCKET already use with no access-key env var of their own. This assumes
  # Langfuse's own S3 client supports that default chain when the key envs are left unset,
  # consistent with most aws-sdk-based S3 clients — not independently verified against
  # Langfuse's own source in this pass; if it turns out not to, that surfaces immediately as
  # an S3 auth failure in langfuse-worker's own logs the first time this is actually applied,
  # not a silent failure.
  shared_environment = {
    NEXTAUTH_URL               = local.web_url
    TELEMETRY_ENABLED          = "false"
    CLICKHOUSE_MIGRATION_URL   = module.clickhouse.native_url
    CLICKHOUSE_URL             = module.clickhouse.http_url
    CLICKHOUSE_CLUSTER_ENABLED = "false"
    REDIS_PORT                 = "6379"
    # modules/cache's own ElastiCache replication group always sets
    # transit_encryption_enabled = true (matching packages/config's own REDIS_URL schema
    # accepting rediss:// for exactly this reason) — Langfuse's own redis client needs to
    # know to speak TLS on that same port, not a plaintext connection to a TLS-only
    # endpoint. No client certs needed: ElastiCache's transit encryption is server-only
    # TLS, not mutual TLS, so REDIS_TLS_CA/CERT/KEY stay at their own unset defaults.
    REDIS_TLS_ENABLED                         = "true"
    LANGFUSE_S3_EVENT_UPLOAD_BUCKET           = module.object_store.bucket_name
    LANGFUSE_S3_EVENT_UPLOAD_REGION           = data.aws_region.current.name
    LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT         = module.object_store.endpoint
    LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE = "false"
    LANGFUSE_S3_EVENT_UPLOAD_PREFIX           = "events/"
    LANGFUSE_S3_MEDIA_UPLOAD_BUCKET           = module.object_store.bucket_name
    LANGFUSE_S3_MEDIA_UPLOAD_REGION           = data.aws_region.current.name
    LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT         = module.object_store.endpoint
    LANGFUSE_S3_MEDIA_UPLOAD_FORCE_PATH_STYLE = "false"
    LANGFUSE_S3_MEDIA_UPLOAD_PREFIX           = "media/"
  }

  shared_secrets = {
    DATABASE_URL        = "${aws_secretsmanager_secret.database_url.arn}:url::"
    CLICKHOUSE_USER     = "${module.clickhouse.credentials_secret_arn}:user::"
    CLICKHOUSE_PASSWORD = "${module.clickhouse.credentials_secret_arn}:password::"
    REDIS_HOST          = "${module.cache.redis_url_secret_arn}:host::"
    REDIS_AUTH          = "${module.cache.redis_url_secret_arn}:auth_token::"
    SALT                = "${aws_secretsmanager_secret.app.arn}:salt::"
    ENCRYPTION_KEY      = "${aws_secretsmanager_secret.app.arn}:encryption_key::"
  }
}

# --- langfuse-worker ------------------------------------------------------------------

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.name}-worker"
      image     = "docker.langfuse.com/langfuse/langfuse-worker:${var.image_tag}"
      essential = true
      portMappings = [
        { containerPort = 3030, protocol = "tcp" }
      ]
      environment = [for k, v in local.shared_environment : { name = k, value = v }]
      secrets     = [for k, arn in local.shared_secrets : { name = k, valueFrom = arn }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "worker" {
  name            = "${var.name}-worker"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [task_definition] # a version bump updates the task def directly
  }

  tags = var.tags
}

resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_count
  min_capacity       = var.worker_min_count
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  name               = "${var.name}-worker-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# --- langfuse-web ---------------------------------------------------------------------

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.name}-web"
      image     = "docker.langfuse.com/langfuse/langfuse:${var.image_tag}"
      essential = true
      portMappings = [
        { containerPort = 3000, protocol = "tcp" }
      ]
      environment = [
        for k, v in merge(local.shared_environment, {
          LANGFUSE_INIT_ORG_ID             = var.init_org_id
          LANGFUSE_INIT_ORG_NAME           = var.init_org_name
          LANGFUSE_INIT_PROJECT_ID         = var.init_project_id
          LANGFUSE_INIT_PROJECT_NAME       = var.init_project_name
          LANGFUSE_INIT_PROJECT_PUBLIC_KEY = local.otlp_public_key
          LANGFUSE_INIT_USER_EMAIL         = var.init_user_email
          LANGFUSE_INIT_USER_NAME          = var.init_user_name
        }) : { name = k, value = v }
      ]
      secrets = [
        for k, arn in merge(local.shared_secrets, {
          NEXTAUTH_SECRET                  = "${aws_secretsmanager_secret.app.arn}:nextauth_secret::"
          LANGFUSE_INIT_PROJECT_SECRET_KEY = "${aws_secretsmanager_secret.otlp.arn}:secret_key::"
          LANGFUSE_INIT_USER_PASSWORD      = "${aws_secretsmanager_secret.app.arn}:init_user_password::"
        }) : { name = k, valueFrom = arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/api/public/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60 # ClickHouse migrations run on this service's own first boot too
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "web" {
  name            = "${var.name}-web"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "${var.name}-web"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = var.tags
}

resource "aws_appautoscaling_target" "web" {
  max_capacity       = var.web_max_count
  min_capacity       = var.web_min_count
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${var.name}-web-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

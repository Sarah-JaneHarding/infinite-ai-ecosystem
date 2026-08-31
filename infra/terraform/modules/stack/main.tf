# Composes every other module (network, database, cache, object-store, ecs-service ×3,
# observability) into one environment — dev, staging, or production each instantiate this
# once, differing only in the variables they pass. Not itself named in
# infra/terraform/README.md's "planned layout" (that lists the leaf modules only), but
# the same composition every environments/<name>/main.tf would otherwise have to
# duplicate three times over; keeping it in one place is what makes dev/staging/
# production a real diff of *values*, not of wiring.
#
# Security groups for the three ECS services are created here, not inside the
# ecs-service module: the database and cache modules need to reference them in their own
# ingress rules, and ecs-service needing database/cache secrets to inject as task
# environment would otherwise make a cycle out of "who creates whose security group."

module "network" {
  source = "../network"

  name               = var.name
  vpc_cidr           = var.vpc_cidr
  azs                = var.azs
  single_nat_gateway = var.single_nat_gateway
  tags               = var.tags
}

resource "aws_security_group" "gateway" {
  name        = "${var.name}-gateway"
  description = "apps/gateway Fargate tasks."
  vpc_id      = module.network.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-gateway" })
}

resource "aws_security_group" "worker" {
  name        = "${var.name}-worker"
  description = "apps/worker Fargate tasks."
  vpc_id      = module.network.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-worker" })
}

resource "aws_security_group" "web" {
  name        = "${var.name}-web"
  description = "apps/web Fargate tasks."
  vpc_id      = module.network.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-web" })
}

# --- Application Load Balancer ---------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Public ALB — inbound 80/443 from the internet, nothing else reaches it directly."
  vpc_id      = module.network.vpc_id

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

resource "aws_lb" "this" {
  name               = var.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.network.public_subnet_ids

  tags = var.tags
}

resource "aws_acm_certificate" "this" {
  count = var.domain_name == null ? 0 : 1

  domain_name               = "api.${var.domain_name}"
  subject_alternative_names = ["app.${var.domain_name}"]
  validation_method         = "DNS"

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

  # Redirects to HTTPS once a domain (and therefore a cert) exists; forwards straight to
  # web otherwise — plain HTTP is the honest state for an environment that has not yet
  # had a real domain decided, not a security bug in this module.
  dynamic "default_action" {
    for_each = var.domain_name == null ? [1] : []
    content {
      type             = "forward"
      target_group_arn = module.ecs_service_web.target_group_arn
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
    target_group_arn = module.ecs_service_web.target_group_arn
  }
}

locals {
  # gateway serves /v1/* and /health (apps/gateway/src/server.ts) — everything else on
  # either listener falls through to web's default action above.
  primary_listener_arn = var.domain_name == null ? aws_lb_listener.http.arn : aws_lb_listener.https[0].arn
}

resource "aws_lb_listener_rule" "gateway" {
  listener_arn = local.primary_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = module.ecs_service_gateway.target_group_arn
  }

  condition {
    path_pattern {
      values = ["/v1/*", "/health"]
    }
  }
}

resource "aws_route53_record" "gateway" {
  count = var.domain_name == null ? 0 : 1

  zone_id = var.dns_zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "web" {
  count = var.domain_name == null ? 0 : 1

  zone_id = var.dns_zone_id
  name    = "app.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

# --- Data plane ------------------------------------------------------------------

module "database" {
  source = "../database"

  name                       = "${var.name}-db"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.gateway.id, aws_security_group.worker.id]

  instance_class           = var.db_instance_class
  allocated_storage_gb     = var.db_allocated_storage_gb
  max_allocated_storage_gb = var.db_max_allocated_storage_gb
  multi_az                 = var.db_multi_az
  backup_retention_days    = var.db_backup_retention_days
  deletion_protection      = var.db_deletion_protection

  tags = var.tags
}

module "cache" {
  source = "../cache"

  name                       = "${var.name}-cache"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.worker.id]

  node_type = var.cache_node_type
  multi_az  = var.cache_multi_az

  tags = var.tags
}

module "object_store" {
  source = "../object-store"

  name = "${var.name}-objects"
  tags = var.tags
}

# --- Compute -----------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

module "ecs_service_gateway" {
  source = "../ecs-service"

  name               = "${var.name}-gateway"
  cluster_id         = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = aws_security_group.gateway.id

  container_port = 8080
  image_tag      = var.gateway_image_tag
  cpu            = var.gateway_cpu
  memory         = var.gateway_memory
  desired_count  = var.gateway_desired_count
  min_count      = var.gateway_min_count
  max_count      = var.gateway_max_count

  attach_to_alb         = true
  alb_security_group_id = aws_security_group.alb.id

  iam_policy_arns = [module.object_store.read_write_policy_arn]

  environment = {
    NODE_ENV     = "production"
    APP_REGION   = "af-south-1"
    LOG_LEVEL    = var.log_level
    GATEWAY_PORT = "8080"
  }

  secrets = {
    DATABASE_URL = "${module.database.app_role_secret_arns["app_rw"]}:url::"
  }

  tags = var.tags
}

module "ecs_service_worker" {
  source = "../ecs-service"

  name               = "${var.name}-worker"
  cluster_id         = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = aws_security_group.worker.id

  container_port = 8081
  image_tag      = var.worker_image_tag
  cpu            = var.worker_cpu
  memory         = var.worker_memory
  desired_count  = var.worker_desired_count
  min_count      = var.worker_min_count
  max_count      = var.worker_max_count

  attach_to_alb = false # a queue consumer, nothing for the ALB to route to

  iam_policy_arns = [module.object_store.read_write_policy_arn]

  environment = {
    NODE_ENV              = "production"
    APP_REGION            = "af-south-1"
    LOG_LEVEL             = var.log_level
    WORKER_PORT           = "8081"
    GATEWAY_BASE_URL      = "http://${aws_lb.this.dns_name}"
    OBJECT_STORE_ENDPOINT = module.object_store.endpoint
    OBJECT_STORE_BUCKET   = module.object_store.bucket_name
  }

  secrets = {
    DATABASE_URL = "${module.database.app_role_secret_arns["worker_rw"]}:url::"
    REDIS_URL    = "${module.cache.redis_url_secret_arn}:url::"
  }

  tags = var.tags
}

module "ecs_service_web" {
  source = "../ecs-service"

  name               = "${var.name}-web"
  cluster_id         = aws_ecs_cluster.this.arn
  cluster_name       = aws_ecs_cluster.this.name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = aws_security_group.web.id

  container_port = 3000
  image_tag      = var.web_image_tag
  cpu            = var.web_cpu
  memory         = var.web_memory
  desired_count  = var.web_desired_count
  min_count      = var.web_min_count
  max_count      = var.web_max_count

  attach_to_alb         = true
  alb_security_group_id = aws_security_group.alb.id

  environment = merge(
    {
      NODE_ENV     = "production"
      NEXTAUTH_URL = var.domain_name == null ? "http://${aws_lb.this.dns_name}" : "https://app.${var.domain_name}"
    },
    var.keycloak_issuer_url == null ? {} : { AUTH_KEYCLOAK_ISSUER = var.keycloak_issuer_url },
  )

  tags = var.tags
}

# --- Observability -----------------------------------------------------------------

module "observability" {
  source = "../observability"

  name             = var.name
  alb_arn_suffix   = aws_lb.this.arn_suffix
  ecs_cluster_name = aws_ecs_cluster.this.name
  ecs_service_names = [
    module.ecs_service_gateway.service_name,
    module.ecs_service_worker.service_name,
    module.ecs_service_web.service_name,
  ]
  target_group_arn_suffixes = {
    gateway = module.ecs_service_gateway.target_group_arn_suffix
    web     = module.ecs_service_web.target_group_arn_suffix
  }
  alert_email = var.alert_email

  tags = var.tags
}

# One Fargate service, instantiated once per app (apps/gateway, apps/worker, apps/web —
# each with its own Dockerfile, built in the Tier 1 deployability work) by the stack
# module. Everything here is generic across the three; what differs between them is
# entirely in the variables the stack module passes: container port, env, secrets,
# whether it sits behind the ALB.

data "aws_region" "current" {}

resource "aws_ecr_repository" "this" {
  name                 = var.name
  image_tag_mutability = "IMMUTABLE" # a deploy always pushes a new tag (the commit SHA); "latest" is never re-pointed

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 20 most recent images; a canary or manual rollback (docs/RUNBOOKS/canary-deploy.md) never needs to reach further back than that."
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days

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

# The managed policy above covers ECR pull + CloudWatch Logs; it does NOT cover reading
# the Secrets Manager values `var.secrets` names, which is a per-environment, per-service
# set of ARNs this policy scopes to exactly those and nothing else.
locals {
  # var.secrets values may carry a ":<json-key>::" suffix (ECS's own syntax for reading
  # one field of a JSON secret — see that variable's own doc comment). A Secrets Manager
  # ARN always has exactly 6 colons (arn:aws:secretsmanager:region:account:secret:id); the
  # 8th colon-separated field onward, if present, is that suffix. Truncating to the first
  # 7 fields recovers the base ARN IAM actually authorizes against, regardless of whether
  # a caller appended a suffix.
  secret_base_arns = distinct([
    for arn in values(var.secrets) : join(":", slice(split(":", arn), 0, 7))
  ])
}

data "aws_iam_policy_document" "execution_secrets" {
  count = length(var.secrets) > 0 ? 1 : 0

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secret_base_arns
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = length(var.secrets) > 0 ? 1 : 0

  name   = "${var.name}-read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-task"
  assume_role_policy = data.aws_iam_policy_document.assume_ecs_task.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_extra" {
  count = length(var.iam_policy_arns)

  role       = aws_iam_role.task.name
  policy_arn = var.iam_policy_arns[count.index]
}

resource "aws_security_group_rule" "from_alb" {
  count = var.attach_to_alb ? 1 : 0

  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  security_group_id        = var.security_group_id
  source_security_group_id = var.alb_security_group_id
}

resource "aws_security_group_rule" "egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = var.security_group_id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.name
      image     = "${aws_ecr_repository.this.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = [for k, v in var.environment : { name = k, value = v }]
      secrets     = [for k, arn in var.secrets : { name = k, valueFrom = arn }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
      # Same /health every app already serves (apps/gateway's own route, apps/worker's
      # health-server.ts) — ECS uses this independent of whether an ALB is attached, so
      # apps/worker (never attach_to_alb) still gets real liveness detection.
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = var.tags
}

resource "aws_lb_target_group" "this" {
  count = var.attach_to_alb ? 1 : 0

  name        = var.name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # required for awsvpc-mode Fargate tasks

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
  }

  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.security_group_id]
    # No public IP: tasks are in private subnets, reachable only via the ALB (when
    # attached) or not directly reachable at all (apps/worker).
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.attach_to_alb ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.this[0].arn
      container_name   = var.name
      container_port   = var.container_port
    }
  }

  # ECS's own rolling deployment (max 200%/min 100% healthy, the resource's own defaults)
  # is what CI's deploy step drives by pushing a new image tag and updating this
  # resource — docs/RUNBOOKS/canary-deploy.md's weighted-traffic steps are the ALB
  # listener-rule / target-group-weight equivalent of the same idea, not built here (a
  # separate follow-up: this resource creates one target group per service, not the
  # paired "stable + canary" target groups a real canary rollout needs).
  lifecycle {
    ignore_changes = [task_definition] # a deploy updates the task def directly; plan should not fight that
  }

  tags = var.tags
}

resource "aws_appautoscaling_target" "this" {
  max_capacity       = var.max_count
  min_capacity       = var.min_count
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.name}-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

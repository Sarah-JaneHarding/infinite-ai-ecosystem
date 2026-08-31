# ElastiCache for Redis — BullMQ's job queue (apps/worker) and the gateway's routing/
# credential-pool cache. Encrypted at rest and in transit (`rediss://`, which
# packages/config/src/env.ts's REDIS_URL schema already accepts alongside plain
# `redis://` for local dev) — there is no reason for this one to be weaker than the
# database's own encryption posture.

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids

  tags = var.tags
}

resource "aws_security_group" "this" {
  name        = "${var.name}-redis"
  description = "Redis 6379 — inbound only from the ECS tasks' own security group."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-redis" })
}

resource "aws_security_group_rule" "ingress" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.this.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

resource "aws_security_group_rule" "egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.this.id
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "random_password" "auth_token" {
  # ElastiCache AUTH tokens: 16-128 chars, no @, ", or / — special=false plus a manual
  # character-set override keeps this simple rather than hand-rolling an allow-list.
  length  = 32
  special = false
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name
  description          = "${var.name} Redis — BullMQ queues + gateway caches"

  engine         = "redis"
  engine_version = "7.1"
  node_type      = var.node_type
  port           = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  num_cache_clusters         = var.multi_az ? 2 : 1
  automatic_failover_enabled = var.multi_az
  multi_az_enabled           = var.multi_az

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.auth_token.result

  tags = var.tags

  lifecycle {
    # Rotating the auth token is a deliberate, coordinated action (every connected client
    # needs the new value before the old one is retired) — never something a stray
    # `terraform apply` should do as a side effect of an unrelated change.
    ignore_changes = [auth_token]
  }
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${var.name}/redis/url"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id = aws_secretsmanager_secret.redis_url.id
  secret_string = jsonencode({
    url = "rediss://:${random_password.auth_token.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
  })
}

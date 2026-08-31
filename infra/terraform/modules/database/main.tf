# RDS for PostgreSQL 16 — the only engine version pgvector supports without a preview
# flag, matching infra/docker/compose.dev.yml's dev image exactly so nothing behaves
# differently between local dev and a real environment.
#
# The master password is RDS-managed (`manage_master_user_password`), never generated or
# read by Terraform itself — RDS creates and rotates it directly in Secrets Manager. Every
# application role Terraform DOES generate a password for (`var.app_role_names`) exists as
# a Postgres role, and the three extensions infra/docker/initdb/01-extensions.sql already
# creates for dev exist on the real instance, only after a human runs
# `./bootstrap-roles.sh <this environment's name>` once — see that script's own header for
# why this is a script rather than a `null_resource` provisioner: this module has no
# network path into the database it just created, and inventing one (a Lambda, a bastion)
# is a bigger decision than "run psql once after `terraform apply`," and the script never
# writes a password to disk — it reads each one from Secrets Manager straight into psql's
# stdin.

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids

  tags = var.tags
}

resource "aws_security_group" "this" {
  name        = "${var.name}-postgres"
  description = "Postgres 5432 — inbound only from the ECS tasks' own security group."
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}

resource "aws_security_group_rule" "ingress" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
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

resource "aws_kms_key" "this" {
  description             = "${var.name} RDS storage encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = var.tags
}

locals {
  # RDS Postgres db names may not contain hyphens; var.name (e.g. "infinite-ai-staging")
  # always does, so this is what bootstrap-roles.sh's GRANT CONNECT ON DATABASE targets.
  db_name = replace(var.name, "-", "_")
}

resource "aws_db_instance" "this" {
  identifier     = var.name
  db_name        = local.db_name
  engine         = "postgres"
  engine_version = var.postgres_version

  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.this.arn

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = false

  username                    = "postgres"
  manage_master_user_password = true

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_days
  backup_window             = "02:00-03:00" # SAST is UTC+2; 04:00-05:00 SAST, lowest-traffic window
  maintenance_window        = "sun:03:00-sun:04:00"
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${var.name}-final" : null

  # RDS Postgres 15+ allows CREATE EXTENSION for these three without a custom parameter
  # group — matching infra/docker/initdb/01-extensions.sql's own comment on why they're
  # created outside Prisma's migrations (the `migrator` role deliberately lacks the
  # privilege). The extensions themselves are created by bootstrap-roles.sh's manual
  # step, not this resource.

  tags = var.tags

  lifecycle {
    # The RDS-managed master password rotates outside Terraform's knowledge; re-syncing it
    # here on every plan would show a permanent, meaningless diff.
    ignore_changes = [password]
  }
}

resource "random_password" "app_role" {
  for_each = toset(var.app_role_names)

  length  = 32
  special = false # simplest to embed safely in a JDBC-style DATABASE_URL with no escaping
}

resource "aws_secretsmanager_secret" "app_role" {
  for_each = toset(var.app_role_names)

  name                    = "${var.name}/db/${each.key}"
  recovery_window_in_days = 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app_role" {
  for_each = toset(var.app_role_names)

  secret_id = aws_secretsmanager_secret.app_role[each.key].id
  secret_string = jsonencode({
    username = each.key
    password = random_password.app_role[each.key].result
    url      = "postgresql://${each.key}:${random_password.app_role[each.key].result}@${aws_db_instance.this.address}:5432/${local.db_name}"
  })
}


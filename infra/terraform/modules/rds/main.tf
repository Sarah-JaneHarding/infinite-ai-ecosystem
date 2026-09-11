terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

variable "db_name" {
  type    = string
  default = "infinite_ai_test"
}

variable "master_username" {
  type    = string
  default = "infinite_admin"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

resource "random_password" "master" {
  length  = 24
  special = false # avoid characters RDS/connection strings sometimes choke on
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "infinite-ai/${var.environment}/rds-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    dbname   = var.db_name
    engine   = "postgres"
  })
}

resource "aws_db_subnet_group" "this" {
  name       = "infinite-ai-${var.environment}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Environment = var.environment
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "infinite-ai-${var.environment}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from ECS tasks only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Environment = var.environment
  }
}

# Postgres 16 with pgvector support — run `CREATE EXTENSION IF NOT EXISTS vector;`
# as a post-provision migration step (pnpm --filter @infinite-ai/db db:migrate:dev).
resource "aws_db_instance" "this" {
  identifier             = "infinite-ai-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.4"
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  db_name                = var.db_name
  username               = var.master_username
  password               = random_password.master.result
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az                = false
  publicly_accessible     = false
  skip_final_snapshot     = true  # test env — no snapshot on teardown
  deletion_protection     = false
  backup_retention_period = 1
  apply_immediately       = true

  tags = {
    Environment = var.environment
    Project     = "infinite-ai"
  }
}

# Full connection URL secret — lets the app read DATABASE_URL directly from Secrets Manager
# rather than assembling it from parts. Created after the instance is provisioned so the
# endpoint address is known.
resource "aws_secretsmanager_secret" "connection_url" {
  name = "infinite-ai/${var.environment}/rds-connection-url"
}

resource "aws_secretsmanager_secret_version" "connection_url" {
  secret_id     = aws_secretsmanager_secret.connection_url.id
  secret_string = "postgresql://${var.master_username}:${random_password.master.result}@${aws_db_instance.this.address}:5432/${var.db_name}"
}

output "endpoint" {
  value = aws_db_instance.this.address
}

output "security_group_id" {
  value = aws_security_group.rds.id
}

output "credentials_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "connection_url_secret_arn" {
  description = "Full PostgreSQL connection URL stored in Secrets Manager — inject directly as DATABASE_URL."
  value       = aws_secretsmanager_secret.connection_url.arn
}

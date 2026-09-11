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

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "infinite-ai-${var.environment}-redis-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name_prefix = "infinite-ai-${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS tasks only"
    from_port       = 6379
    to_port         = 6379
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

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "infinite-ai-${var.environment}"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_nodes      = 1  # single node for test; no failover needed here
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = {
    Environment = var.environment
    Project     = "infinite-ai"
  }
}

output "primary_endpoint" {
  value = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "security_group_id" {
  value = aws_security_group.redis.id
}

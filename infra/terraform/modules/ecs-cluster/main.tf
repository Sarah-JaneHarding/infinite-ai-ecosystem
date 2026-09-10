variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

resource "aws_ecs_cluster" "this" {
  name = "infinite-ai-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
    Project     = "infinite-ai"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    # FARGATE_SPOT for test workloads: cheaper; interruptions are acceptable at this tier
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }
}

# Shared security group for all ECS tasks in this cluster
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "infinite-ai-${var.environment}-ecs-"
  vpc_id      = var.vpc_id

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

output "cluster_id" {
  value = aws_ecs_cluster.this.id
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs_tasks.id
}

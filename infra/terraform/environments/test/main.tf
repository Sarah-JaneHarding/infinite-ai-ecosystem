# The test environment — a lightweight AWS environment for validating infrastructure
# changes before they reach staging. Uses the same modules as staging/production but
# with cost-optimised defaults: Fargate SPOT, t4g.micro instances, single NAT gateway,
# 7-day log retention, no Multi-AZ, no alarms.
#
# NOT a replacement for the docker-compose dev stack (infra/docker/compose.dev.yml) that
# local development uses. This exists to prove the infrastructure modules themselves,
# not for day-to-day development.
#
# Run `scripts/cd/build-and-push-test.sh <aws-account-id>` to push :test images to the
# ECR repositories the ecs-service modules create here, then re-apply to point the
# running services at the new images.

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    # Partial configuration — supply real values via
    # `terraform init -backend-config=backend.hcl` or `-backend-config=key=value` flags.
    # See infra/terraform/environments/dev/backend.hcl.example for the expected keys.
    # Bootstrap (infra/terraform/bootstrap/) must be applied first.
    key     = "test/terraform.tfstate"
    region  = "af-south-1"
    encrypt = true
  }
}

provider "aws" {
  region = "af-south-1"

  default_tags {
    tags = {
      Project     = "infinite-ai"
      Environment = "test"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  environment = "test"
  # The :test tag is pushed by scripts/cd/build-and-push-test.sh; update this and
  # re-apply to roll a new image into the running services.
  image_tag = "test"
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = local.environment
}

module "ecs_cluster" {
  source      = "../../modules/ecs-cluster"
  environment = local.environment
  vpc_id      = module.vpc.vpc_id
}

module "rds" {
  source                = "../../modules/rds"
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.ecs_cluster.ecs_security_group_id
}

module "redis" {
  source                = "../../modules/elasticache"
  environment           = local.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = module.ecs_cluster.ecs_security_group_id
}

# Shared plain environment variables injected into all three services
locals {
  shared_env = {
    NODE_ENV   = "test"
    REDIS_URL  = "redis://${module.redis.primary_endpoint}:6379"
    AWS_REGION = "af-south-1"
  }
}

module "gateway" {
  source             = "../../modules/ecs-service"
  name               = "infinite-ai-test-gateway"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.vpc.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.vpc.private_subnet_ids
  container_port     = 8080
  image_tag          = local.image_tag
  cpu                = 512
  memory             = 1024
  environment        = local.shared_env
  secrets = {
    DATABASE_URL = module.rds.connection_url_secret_arn
  }
  log_retention_days = 7
}

module "web" {
  source             = "../../modules/ecs-service"
  name               = "infinite-ai-test-web"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.vpc.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.vpc.private_subnet_ids
  container_port     = 3000
  image_tag          = local.image_tag
  cpu                = 512
  memory             = 1024
  environment = merge(local.shared_env, {
    # Cloud Map / service discovery address for the gateway — configure separately
    GATEWAY_URL = "http://infinite-ai-test-gateway.infinite-ai-test.local:8080"
  })
  log_retention_days = 7
}

module "worker" {
  source             = "../../modules/ecs-service"
  name               = "infinite-ai-test-worker"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.vpc.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.vpc.private_subnet_ids
  container_port     = 8081
  image_tag          = local.image_tag
  cpu                = 512
  memory             = 1024
  environment        = local.shared_env
  secrets = {
    DATABASE_URL = module.rds.connection_url_secret_arn
  }
  log_retention_days = 7
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "redis_endpoint" {
  value = module.redis.primary_endpoint
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "gateway_ecr_repository_url" {
  value = module.gateway.ecr_repository_url
}

output "web_ecr_repository_url" {
  value = module.web.ecr_repository_url
}

output "worker_ecr_repository_url" {
  value = module.worker.ecr_repository_url
}

# The test environment — a lightweight AWS environment for validating infrastructure
# changes before they reach staging. Uses the same network/database/cache modules as
# staging/production (via modules/stack), composed directly rather than through
# modules/stack itself — no ALB, Langfuse, SES, observability, or safeguarding SNS topic,
# none of which this environment's own purpose (prove the network/data-plane modules
# work) needs. Cost-optimised defaults: Fargate SPOT (ecs-cluster module), single NAT
# gateway, t4g.micro instances, no Multi-AZ, 7-day log retention, no alarms — every one
# of those is simply each module's own default, not a value overridden here.
#
# NOT a replacement for the docker-compose dev stack (infra/docker/compose.dev.yml) that
# local development uses. This exists to prove the infrastructure modules themselves,
# not for day-to-day development.
#
# Run `scripts/cd/build-and-push-test.sh <aws-account-id>` to push :test images to the
# ECR repositories the ecs-service modules create here, then re-apply to point the
# running services at the new images. After the first `apply`, run
# `../../modules/database/bootstrap-roles.sh infinite-ai-test` once to create the
# migrator/app_rw/worker_rw/analytics_ro Postgres roles and extensions — see that
# script's own header.

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
  name        = "infinite-ai-test"
  # The :test tag is pushed by scripts/cd/build-and-push-test.sh; update this and
  # re-apply to roll a new image into the running services.
  image_tag = "test"
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  single_nat_gateway = true
}

module "ecs_cluster" {
  source      = "../../modules/ecs-cluster"
  environment = local.environment
  vpc_id      = module.network.vpc_id
}

module "database" {
  source = "../../modules/database"

  name                       = "${local.name}-db"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.ecs_security_group_id]
}

module "cache" {
  source = "../../modules/cache"

  name                       = "${local.name}-cache"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.ecs_cluster.ecs_security_group_id]
}

# Shared plain environment variables injected into all three services. DATABASE_URL and
# REDIS_URL are NOT here — both carry credentials (a generated app-role password, a
# Redis AUTH token) and are injected as `secrets` on the services that need them instead,
# matching modules/stack's own ecs_service_gateway/ecs_service_worker pattern exactly.
locals {
  shared_env = {
    NODE_ENV   = "test"
    AWS_REGION = "af-south-1"
  }
}

module "gateway" {
  source             = "../../modules/ecs-service"
  name               = "infinite-ai-test-gateway"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.network.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.network.private_subnet_ids
  container_port     = 8080
  image_tag          = local.image_tag
  cpu                = 512
  memory             = 1024
  environment        = local.shared_env
  secrets = {
    # ":url::" reads the app_rw role's own JSON secret's url field — see the database
    # module's own header for the four-role shape this matches from infra/docker/initdb.
    DATABASE_URL = "${module.database.app_role_secret_arns["app_rw"]}:url::"
  }
  log_retention_days = 7
}

module "web" {
  source             = "../../modules/ecs-service"
  name               = "infinite-ai-test-web"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  vpc_id             = module.network.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.network.private_subnet_ids
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
  vpc_id             = module.network.vpc_id
  security_group_id  = module.ecs_cluster.ecs_security_group_id
  private_subnet_ids = module.network.private_subnet_ids
  container_port     = 8081
  image_tag          = local.image_tag
  cpu                = 512
  memory             = 1024
  environment        = local.shared_env
  secrets = {
    DATABASE_URL = "${module.database.app_role_secret_arns["worker_rw"]}:url::"
    REDIS_URL    = "${module.cache.redis_url_secret_arn}:url::"
  }
  log_retention_days = 7
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "cache_endpoint" {
  value = module.cache.primary_endpoint_address
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

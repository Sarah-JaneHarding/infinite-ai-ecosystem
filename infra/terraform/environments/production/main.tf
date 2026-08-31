# The production environment — Multi-AZ database and cache, one NAT gateway per AZ (an
# AZ outage does not take outbound internet with it), deletion protection on, at least 2
# tasks per service (an ECS deployment or a task crash never drops a service to zero).
# docs/RUNBOOKS/region-loss.md's cross-region failover is deliberately not automated by
# this environment — that runbook's own "Cloud console -> Promote replica" manual step and
# annual drill requirement (Stage 15) reflect a decision already made not to automate
# region failover from Terraform; a promoted cross-region read replica would be its own
# module and its own real decision (which region, cost, when to actually build it), not
# assumed here.

terraform {
  backend "s3" {
    key     = "production/terraform.tfstate"
    region  = "af-south-1"
    encrypt = true
  }
}

provider "aws" {
  region = "af-south-1"

  default_tags {
    tags = {
      Project     = "infinite-ai"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

module "stack" {
  source = "../../modules/stack"

  name = "infinite-ai-production"

  single_nat_gateway = false
  db_multi_az        = true
  cache_multi_az     = true

  db_instance_class        = "db.t4g.medium"
  db_backup_retention_days = 14
  db_deletion_protection   = true

  cache_node_type = "cache.t4g.small"

  domain_name = var.domain_name
  dns_zone_id = var.dns_zone_id
  alert_email = var.alert_email

  gateway_desired_count = 2
  gateway_min_count     = 2
  worker_desired_count  = 2
  worker_min_count      = 2
  web_desired_count     = 2
  web_min_count         = 2

  gateway_image_tag = var.gateway_image_tag
  worker_image_tag  = var.worker_image_tag
  web_image_tag     = var.web_image_tag
}

# The production environment — Multi-AZ database and cache, one NAT gateway per AZ (an
# AZ outage does not take outbound internet with it), deletion protection on, at least 2
# tasks per service (an ECS deployment or a task crash never drops a service to zero).
# There is NO cross-region failover: no secondary region, replica or off-region copy is built,
# and docs/RUNBOOKS/region-loss.md (rewritten 2026-11-26, OQ-061) says so and commits to no
# RTO or RPO for a Region loss. Multi-AZ above covers losing one availability zone, not a
# Region. A cross-region replica or an encrypted off-region export would be its own module and
# its own real decision (where, cost, POPIA s72, key custody), not assumed here.

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

  name        = "infinite-ai-production"
  environment = "production"

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

  monthly_budget_zar  = var.monthly_budget_zar
  zar_per_usd         = var.zar_per_usd
  budget_alert_emails = var.budget_alert_emails
  keycloak_client_id  = var.keycloak_client_id

  gateway_desired_count = 2
  gateway_min_count     = 2
  worker_desired_count  = 2
  worker_min_count      = 2
  web_desired_count     = 2
  web_min_count         = 2

  gateway_image_tag = var.gateway_image_tag
  worker_image_tag  = var.worker_image_tag
  web_image_tag     = var.web_image_tag

  # Same Multi-AZ reasoning as the app's own database/cache above: losing this to a
  # single AZ outage should not also take out LLM observability. ClickHouse itself
  # stays single-node regardless (modules/clickhouse's own header explains why a real
  # cluster is separate, future work) — Multi-AZ here covers Langfuse's own Postgres/
  # Redis, not ClickHouse.
  langfuse_db_multi_az              = true
  langfuse_cache_multi_az           = true
  langfuse_clickhouse_instance_type = "t4g.large"
  langfuse_init_user_email          = var.langfuse_init_user_email
}

# The staging environment — docs/RUNBOOKS/canary-deploy.md's canary steps and the
# database-restore/region-loss drills all run against this before production, per
# database-restore.md's own "Live drill against staging required before GA" line. Single
# NAT, no Multi-AZ yet (cost) — the drills this environment exists for are about restore
# procedure correctness, not surviving a real AZ outage, which is what production's own
# Multi-AZ is for.

terraform {
  backend "s3" {
    key     = "staging/terraform.tfstate"
    region  = "af-south-1"
    encrypt = true
  }
}

provider "aws" {
  region = "af-south-1"

  default_tags {
    tags = {
      Project     = "infinite-ai"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

module "stack" {
  source = "../../modules/stack"

  name = "infinite-ai-staging"

  single_nat_gateway = true
  db_multi_az        = false
  cache_multi_az     = false

  db_instance_class = "db.t4g.small"
  cache_node_type   = "cache.t4g.micro"

  domain_name = var.domain_name
  dns_zone_id = var.dns_zone_id
  alert_email = var.alert_email

  gateway_desired_count = 1
  worker_desired_count  = 1
  web_desired_count     = 1

  gateway_image_tag = var.gateway_image_tag
  worker_image_tag  = var.worker_image_tag
  web_image_tag     = var.web_image_tag

  langfuse_init_user_email = var.langfuse_init_user_email
}

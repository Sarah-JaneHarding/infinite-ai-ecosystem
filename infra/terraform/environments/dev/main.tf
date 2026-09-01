# The dev environment — a real, small, single-AZ-tolerant AWS environment for testing
# infrastructure changes themselves (this Terraform), NOT a replacement for the
# docker-compose dev stack (docs/DEV_SETUP.md) that every day-to-day local development
# session already uses. No domain, no Multi-AZ, one NAT gateway, the smallest instance
# classes every module defaults to.

terraform {
  backend "s3" {
    # Partial configuration deliberately — rule 7 forbids a real bucket/table name here
    # even though neither is a secret, because both only exist once bootstrap/ has been
    # applied by a human with real AWS credentials, which has not happened in any
    # environment this repository has been developed in. Supply the real values via
    # `terraform init -backend-config=backend.hcl` (see backend.hcl.example) or
    # `-backend-config=key=value` flags — never by editing this block directly, so a
    # git diff of this file is never the place a bucket name could leak from.
    key     = "dev/terraform.tfstate"
    region  = "af-south-1"
    encrypt = true
  }
}

provider "aws" {
  region = "af-south-1"

  default_tags {
    tags = {
      Project     = "infinite-ai"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

module "stack" {
  source = "../../modules/stack"

  name = "infinite-ai-dev"

  single_nat_gateway = true
  db_multi_az        = false
  cache_multi_az     = false

  db_instance_class = "db.t4g.micro"
  cache_node_type   = "cache.t4g.micro"

  # No domain yet — the ALB's own DNS name over plain HTTP is what dev gets until a real
  # subdomain is decided (see modules/stack/variables.tf's own domain_name doc comment).
  domain_name = null
  alert_email = var.alert_email

  gateway_desired_count = 1
  worker_desired_count  = 1
  web_desired_count     = 1

  gateway_image_tag = var.gateway_image_tag
  worker_image_tag  = var.worker_image_tag
  web_image_tag     = var.web_image_tag

  langfuse_init_user_email = var.langfuse_init_user_email
}

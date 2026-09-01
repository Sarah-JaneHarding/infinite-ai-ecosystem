variable "name" {
  description = "e.g. \"infinite-ai-staging-langfuse\" — prefixes every resource this module creates."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  description = "For this module's own ALB — Langfuse gets a dedicated ALB rather than a listener rule on the main app's, since host-based routing needs a real domain to route on and this module must also work with domain_name = null (dev/staging before a subdomain is decided)."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "At least two, in different AZs — Postgres and Redis both need a multi-AZ-capable subnet group even when multi_az itself is off."
  type        = list(string)
}

variable "clickhouse_subnet_id" {
  description = "Exactly one of private_subnet_ids — see modules/clickhouse's own variable for why a single AZ, not a list."
  type        = string
}

variable "cluster_id" {
  description = "The shared ECS cluster (one per environment, created by modules/stack) langfuse-web and langfuse-worker run on — the same cluster gateway/worker/web already run on, not a second one."
  type        = string
}

variable "cluster_name" {
  type = string
}

# --- DNS / TLS (optional, mirrors modules/stack's own domain_name/dns_zone_id shape) ---

variable "domain_name" {
  description = "The full hostname for Langfuse's own UI, e.g. \"langfuse.infinite-ai.benjaminpine.co.za\" — modules/stack computes this from its own var.domain_name (\"langfuse.\" prefix), not a second independent domain decision. Null (plain HTTP on this module's own ALB DNS name) until a real subdomain exists, same fallback modules/stack's own ALB already uses for api./app."
  type        = string
  default     = null
}

variable "dns_zone_id" {
  type    = string
  default = null
}

# --- Sizing ------------------------------------------------------------------------

variable "clickhouse_instance_type" {
  type    = string
  default = "t4g.medium"
}

variable "clickhouse_volume_size_gb" {
  type    = number
  default = 50
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "cache_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "cache_multi_az" {
  type    = bool
  default = false
}

variable "web_cpu" {
  type    = number
  default = 512
}
variable "web_memory" {
  type    = number
  default = 1024
}
variable "web_desired_count" {
  type    = number
  default = 1
}
variable "web_min_count" {
  type    = number
  default = 1
}
variable "web_max_count" {
  type    = number
  default = 2
}

variable "worker_cpu" {
  type    = number
  default = 512
}
variable "worker_memory" {
  type    = number
  default = 1024
}
variable "worker_desired_count" {
  type    = number
  default = 1
}
variable "worker_min_count" {
  type    = number
  default = 1
}
variable "worker_max_count" {
  type    = number
  default = 2
}

variable "image_tag" {
  description = "Langfuse's own release tag — third-party software this repo's own CD pipeline (.github/workflows/cd.yml) does not build or push; bumping this is a deliberate, reviewed version upgrade a human makes, the same as bumping any other pinned third-party image tag in this Terraform tree (e.g. quay.io/keycloak/keycloak's own version). Defaults to the version validated against infra/docker/compose.dev.yml's own langfuse-web/langfuse-worker services."
  type        = string
  default     = "4.25.0"
}

# --- Bootstrap (LANGFUSE_INIT_* — first-boot org/project/user, matching
# infra/docker/compose.dev.yml's own dev bootstrap) ------------------------------------

variable "init_org_id" {
  type    = string
  default = "infinite-ai"
}

variable "init_org_name" {
  type    = string
  default = "INFINITE-AI"
}

variable "init_project_id" {
  type    = string
  default = "infinite-ai"
}

variable "init_project_name" {
  type    = string
  default = "infinite-ai"
}

variable "init_user_email" {
  description = "The first admin account's email. No default: who administers this environment's own Langfuse instance is a real per-environment decision, the same as production's own domain_name having none."
  type        = string
}

variable "init_user_name" {
  type    = string
  default = "Platform Admin"
}

variable "tags" {
  type    = map(string)
  default = {}
}

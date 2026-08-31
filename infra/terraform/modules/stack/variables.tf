variable "name" {
  description = "Environment prefix, e.g. \"infinite-ai-staging\". Used as the base for every child resource's own name."
  type        = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["af-south-1a", "af-south-1b"]
}

variable "single_nat_gateway" {
  type    = bool
  default = true
}

# --- Database -----------------------------------------------------------------

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage_gb" {
  type    = number
  default = 100
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

# --- Cache ---------------------------------------------------------------------

variable "cache_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "cache_multi_az" {
  type    = bool
  default = false
}

# --- DNS / TLS (optional) --------------------------------------------------------

variable "domain_name" {
  description = "e.g. \"infinite-ai.benjaminpine.co.za\" — docs/RUNBOOKS/region-loss.md already names api.infinite-ai.benjaminpine.co.za as the gateway's real domain, so \"api.\" + this and \"app.\" + this are what this module provisions when set. Leave null to stand up the environment on the ALB's own DNS name over plain HTTP only — a real starting point for a first `apply` before DNS ownership / a Route53 zone is confirmed, not a production-ready end state."
  type        = string
  default     = null
}

variable "dns_zone_id" {
  description = "Route53 hosted zone ID for var.domain_name. Required (and only used) when domain_name is set."
  type        = string
  default     = null
}

# --- Per-service sizing ----------------------------------------------------------
# See modules/ecs-service/variables.tf's own cpu/memory doc comment: these defaults are a
# real starting point for a 3-pilot-school scale, not a load-tested conclusion (OQ-017).

variable "gateway_cpu" {
  type    = number
  default = 512
}
variable "gateway_memory" {
  type    = number
  default = 1024
}
variable "gateway_desired_count" {
  type    = number
  default = 1
}
variable "gateway_min_count" {
  type    = number
  default = 1
}
variable "gateway_max_count" {
  type    = number
  default = 4
}
variable "gateway_image_tag" {
  type    = string
  default = "unreleased"
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
  default = 4
}
variable "worker_image_tag" {
  type    = string
  default = "unreleased"
}

variable "web_cpu" {
  type    = number
  default = 256
}
variable "web_memory" {
  type    = number
  default = 512
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
  default = 4
}
variable "web_image_tag" {
  type    = string
  default = "unreleased"
}

# --- Application configuration (non-secret env vars) ------------------------------

variable "log_level" {
  type    = string
  default = "info"
}

variable "keycloak_issuer_url" {
  description = "Required once a real Keycloak deployment exists for this environment — see infra/keycloak/realm.json and docs/DEV_SETUP.md's own note that a real environment needs a real realm import, not the local docker-compose one. Left null (and the env var simply omitted from the task definition) until then, matching this repo's own \"mechanism now, real config once it exists\" convention rather than inventing a placeholder URL."
  type        = string
  default     = null
}

variable "alert_email" {
  type    = string
  default = null
}

variable "tags" {
  type    = map(string)
  default = {}
}

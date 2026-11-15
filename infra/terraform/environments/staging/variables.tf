variable "domain_name" {
  description = "e.g. \"staging.infinite-ai.benjaminpine.co.za\" — null (plain HTTP on the ALB's own DNS name) until a real subdomain and Route53 zone are decided."
  type        = string
  default     = null
}

variable "dns_zone_id" {
  type    = string
  default = null
}

variable "alert_email" {
  type    = string
  default = null
}

variable "gateway_image_tag" {
  type    = string
  default = "unreleased"
}

variable "worker_image_tag" {
  type    = string
  default = "unreleased"
}

variable "web_image_tag" {
  type    = string
  default = "unreleased"
}

variable "langfuse_init_user_email" {
  description = "The first admin account for this environment's own self-hosted Langfuse instance. No default — see modules/langfuse's own doc comment on this variable; pass explicitly at apply time."
  type        = string
}

variable "monthly_budget_zar" {
  description = "Monthly AWS cost limit in rand for this environment's budget. Non-secret; set in staging.tfvars. Null creates no budget."
  type        = number
  default     = null
}

variable "zar_per_usd" {
  description = "Rand per US dollar used to convert monthly_budget_zar to the USD AWS enforces. Non-secret; set in staging.tfvars next to the budget."
  type        = number
  default     = null
}

variable "budget_alert_emails" {
  description = "Extra OPERATIONAL budget alert recipients (alert_email always receives alerts too); never a person's email or phone. Non-secret; set in staging.tfvars."
  type        = list(string)
  default     = []
}

variable "keycloak_client_id" {
  description = "The Keycloak client id apps/web authenticates as (AUTH_KEYCLOAK_ID). Non-secret; set in staging.tfvars."
  type        = string
  default     = null
}

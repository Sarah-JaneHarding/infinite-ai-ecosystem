variable "domain_name" {
  description = "e.g. \"infinite-ai.benjaminpine.co.za\" — when set, enables HTTPS, SES email, and the Route 53 DNS records. null = plain HTTP (ALB only); acceptable until a domain is procured."
  type        = string
  default     = null
}

variable "dns_zone_id" {
  description = "Route 53 hosted zone ID for domain_name. Required when domain_name is set; ignored otherwise."
  type        = string
  default     = null
}

variable "alert_email" {
  type = string
}

variable "gateway_image_tag" {
  type = string
}

variable "worker_image_tag" {
  type = string
}

variable "web_image_tag" {
  type = string
}

variable "langfuse_init_user_email" {
  description = "The first admin account for this environment's own self-hosted Langfuse instance. No default, same as domain_name above — pass explicitly at apply time."
  type        = string
}

variable "monthly_budget_zar" {
  description = "Monthly AWS cost limit in rand for this environment's budget. Non-secret; set in production.tfvars. Null creates no budget."
  type        = number
  default     = null
}

variable "zar_per_usd" {
  description = "Rand per US dollar used to convert monthly_budget_zar to the USD AWS enforces. Non-secret; set in production.tfvars next to the budget."
  type        = number
  default     = null
}

variable "budget_alert_emails" {
  description = "Extra OPERATIONAL budget alert recipients (alert_email always receives alerts too); never a person's email or phone. Non-secret; set in production.tfvars."
  type        = list(string)
  default     = []
}

variable "keycloak_client_id" {
  description = "The Keycloak client id apps/web authenticates as (AUTH_KEYCLOAK_ID). Non-secret; set in production.tfvars."
  type        = string
  default     = null
}

variable "keycloak_issuer_url" {
  description = "The Keycloak realm issuer apps/web signs in against and provisions through (AUTH_KEYCLOAK_ISSUER), e.g. https://id.example/realms/infinite-ai. Null leaves apps/web on its localhost default, which only works in development. Required before keycloak_provisioner_enabled."
  type        = string
  default     = null
}

variable "keycloak_provisioner_enabled" {
  description = "OQ-048 (a): map the Keycloak provisioner client into the web task. Off until KEYCLOAK_PROVISIONER_CLIENT_SECRET is populated and keycloak_issuer_url is set. See modules/stack."
  type        = bool
  default     = false
}

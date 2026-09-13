variable "domain_name" {
  description = "e.g. \"infinite-ai.benjaminpine.co.za\" — when set, enables HTTPS, SES email, and the Route 53 DNS records. null = plain HTTP (ALB only); acceptable until a domain is procured."
  type    = string
  default = null
}

variable "dns_zone_id" {
  description = "Route 53 hosted zone ID for domain_name. Required when domain_name is set; ignored otherwise."
  type    = string
  default = null
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

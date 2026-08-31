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

variable "domain_name" {
  description = "e.g. \"infinite-ai.benjaminpine.co.za\" — matches docs/RUNBOOKS/region-loss.md's own api.infinite-ai.benjaminpine.co.za reference. No default: production should not silently apply without a real domain decided, even though the stack module itself tolerates null (plain HTTP) for dev/staging."
  type        = string
}

variable "dns_zone_id" {
  type = string
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

variable "alert_email" {
  description = "Where CloudWatch alarms notify. No default — pass explicitly at apply time (-var or a local, gitignored .auto.tfvars) rather than committing a real address."
  type        = string
  default     = null
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

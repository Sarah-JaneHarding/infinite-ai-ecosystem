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

variable "langfuse_init_user_email" {
  description = "The first admin account for this environment's own self-hosted Langfuse instance. No default — see modules/langfuse's own doc comment on this variable; pass explicitly at apply time."
  type        = string
}

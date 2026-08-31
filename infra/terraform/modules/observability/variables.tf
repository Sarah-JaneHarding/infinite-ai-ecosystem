variable "name" {
  type = string
}

variable "alb_arn_suffix" {
  description = "The ALB's own arn_suffix (not its full ARN — CloudWatch's ApplicationELB metrics dimension wants the short form), e.g. module.alb.this.arn_suffix."
  type        = string
}

variable "target_group_arn_suffixes" {
  description = "Map of service name => target group arn_suffix, for the services that have one (attach_to_alb = true in the ecs-service module — apps/gateway, apps/web; apps/worker has none and is not alarmed on ALB metrics here)."
  type        = map(string)
}

variable "ecs_cluster_name" {
  type = string
}

variable "ecs_service_names" {
  description = "Every service in this environment, for CPU/memory alarms — including apps/worker, which has no ALB target group but still runs on Fargate."
  type        = list(string)
}

variable "alert_email" {
  description = "Where CloudWatch alarms publish to, via the SNS topic this module creates. A placeholder, not OQ-014's real paging integration — an email subscription is not a page, and this module does not claim otherwise. Leave null to create the topic with no subscriber yet."
  type        = string
  default     = null
}

variable "error_rate_threshold_pct" {
  description = "docs/RUNBOOKS/canary-deploy.md's own automatic-rollback threshold (1% for 2 consecutive minutes) — reused here as the alarm threshold for the whole environment, not just a canary in progress, since the runbook's number is already the one number in this repo for \"how much 5xx is too much.\""
  type        = number
  default     = 1
}

variable "latency_p95_threshold_seconds" {
  description = "docs/RUNBOOKS/canary-deploy.md's own automatic-rollback threshold (p95 > 10s for 2 consecutive minutes)."
  type        = number
  default     = 10
}

variable "tags" {
  type    = map(string)
  default = {}
}

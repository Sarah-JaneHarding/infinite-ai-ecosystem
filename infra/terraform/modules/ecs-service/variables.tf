variable "name" {
  description = "e.g. \"infinite-ai-staging-gateway\" — must be unique across every service instantiating this module in one environment."
  type        = string
}

variable "cluster_id" {
  description = "The shared ECS cluster's ARN (one per environment, created once by the stack module) every service in that environment runs on — what aws_ecs_service.cluster accepts."
  type        = string
}

variable "cluster_name" {
  description = "The same cluster's short name — aws_appautoscaling_target's resource_id needs the name, not the ARN, in its \"service/<cluster-name>/<service-name>\" form."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "security_group_id" {
  description = "Created by the stack module, not this one: the database and cache modules also need to reference it in their own ingress rules (\"allow from the app's security group\"), and this module needing database/cache secrets to inject as env would otherwise make a cycle out of \"who creates whose security group.\" This module only adds ingress/egress rules to it."
  type        = string
}

variable "private_subnet_ids" {
  description = "Fargate tasks run here, never in a public subnet — outbound internet (pulling the image, reaching the Model Gateway's own provider calls) goes through the network module's NAT gateway."
  type        = list(string)
}

variable "container_port" {
  type = number
}

variable "image_tag" {
  description = "The tag this module's ECR repository is currently pointed at. Terraform owns the repository, not what's pushed to it or which tag is live — a CD pipeline pushes a new image and updates this var (then re-applies, or calls `aws ecs update-service --force-new-deployment` directly) on every deploy. Defaults to a tag that does not exist yet; the very first `terraform apply` for a new environment creates the service in a state that cannot start a task until a real image is pushed and this is updated — expected for a from-scratch environment, not a bug."
  type        = string
  default     = "unreleased"
}

variable "cpu" {
  description = "Fargate CPU units (256 = 0.25 vCPU). 256/512 is a real starting point for 3 pilot schools' traffic, not a load-tested conclusion — apps/gateway and apps/web serve requests, apps/worker's cost scales with queue depth, and all three should be re-sized once docs/RUNBOOKS' load-test task (OQ-017) has real numbers."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate memory in MiB. Must be a valid (cpu, memory) pair per AWS Fargate's task-size table."
  type        = number
  default     = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "min_count" {
  type    = number
  default = 1
}

variable "max_count" {
  type    = number
  default = 3
}

variable "environment" {
  description = "Plain (non-secret) container environment variables."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Container environment variables sourced from Secrets Manager at task start — never baked into the task definition or an image layer. Map of env-var-name => secret ARN (a plain secret ARN reads the whole value; append \":json-key::\" to read one field of a JSON secret, e.g. the database module's own app-role secrets)."
  type        = map(string)
  default     = {}
}

variable "iam_policy_arns" {
  description = "Extra IAM policies attached to the task role (not the execution role) — e.g. the object-store module's own read_write_policy_arn output. The execution role (image pull, log write, secret read) is managed entirely by this module and never widened by a caller."
  type        = list(string)
  default     = []
}

variable "health_check_path" {
  description = "Every app in this repo exposes one (apps/gateway and apps/web via their own routes, apps/worker via health-server.ts) — used for both the ECS container health check and, when attached, the ALB target group's health check."
  type        = string
  default     = "/health"
}

variable "attach_to_alb" {
  description = "true for apps/gateway and apps/web (need inbound HTTP from the ALB); false for apps/worker (a queue consumer with nothing for the ALB to route to — its health check is container-level only)."
  type        = bool
  default     = false
}

variable "alb_security_group_id" {
  description = "Required when attach_to_alb is true — the ALB's own security group, so this service's security group can allow inbound only from it, never from 0.0.0.0/0 directly."
  type        = string
  default     = null
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}

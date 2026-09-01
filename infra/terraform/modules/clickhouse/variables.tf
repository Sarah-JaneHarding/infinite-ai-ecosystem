variable "name" {
  description = "e.g. \"infinite-ai-staging-langfuse-ch\" — prefixes every resource this module creates."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_id" {
  description = "Exactly one — not a list. An EBS volume is AZ-locked, same as the instance it attaches to; a single ClickHouse node cannot be spread across subnets the way a stateless Fargate service can. Real replication/HA (ClickHouse Keeper, a real cluster) is future work, not attempted here — see this module's own header comment."
  type        = string
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to reach ClickHouse on 8123 (HTTP) and 9000 (native) — langfuse-web's and langfuse-worker's own security groups, and nothing else."
  type        = list(string)
}

variable "instance_type" {
  description = "t4g.medium (Graviton, matching this repo's other Graviton choices — db.t4g.*, cache.t4g.*) is a real starting point for a 3-pilot-school scale, not a load-tested conclusion (same caveat modules/database and modules/ecs-service's own sizing variables already carry)."
  type        = string
  default     = "t4g.medium"
}

variable "volume_size_gb" {
  description = "gp3, ClickHouse's own data directory only (not the root volume). 50GB is a starting point for a pilot's trace volume, not a capacity-planned figure."
  type        = number
  default     = 50
}

variable "clickhouse_version" {
  description = "Pinned to the exact image already validated in infra/docker/compose.dev.yml's own langfuse-clickhouse service, so dev and this environment run the identical ClickHouse build."
  type        = string
  default     = "25.12"
}

variable "tags" {
  type    = map(string)
  default = {}
}

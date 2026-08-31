variable "name" {
  description = "Name prefix, e.g. \"infinite-ai-staging\"."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  description = "At least two, in different AZs — required for a DB subnet group."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to reach Postgres on 5432 — the ECS tasks' own security group from the stack module. Nothing else, ever: rule 5's tenant isolation starts with who can open a TCP connection at all."
  type        = list(string)
}

variable "instance_class" {
  description = "db.t4g.micro is the smallest Graviton class RDS Postgres offers — a real starting point for a 3-tenant pilot, not a load-tested conclusion. Re-size once a real workload exists to measure against."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage_gb" {
  type    = number
  default = 20
}

variable "max_allocated_storage_gb" {
  description = "RDS storage autoscaling ceiling. Set comfortably above the starting size so a burst doesn't need a manual resize mid-incident."
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Standby replica in a second AZ, synchronous replication, automatic failover. Off for dev/staging (cost); on for production — this is what docs/RUNBOOKS/database-restore.md's PITR path assumes exists alongside, not instead of."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "How long RDS keeps automated snapshots + WAL for point-in-time recovery. docs/RUNBOOKS/database-restore.md's RPO (<=5 min) needs continuous WAL archiving, which this turns on; the retention window is how far back PITR can reach."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "postgres_version" {
  description = "Must support pgvector without a preview/extra flag — pg16 does. Matches infra/docker/compose.dev.yml's pgvector/pgvector:pg16 image."
  type        = string
  default     = "16.4"
}

variable "app_role_names" {
  description = "Least-privilege Postgres roles this environment needs, matching infra/docker/initdb/02-roles.sh's dev roles exactly so the same migrations and RLS policies apply unchanged. A generated password per role is written to Secrets Manager for ECS tasks to read at boot; the remote state backend (bootstrap/) must have encryption and access control on regardless, since a generated password is still a plaintext value in Terraform state until it is."
  type        = list(string)
  default     = ["migrator", "app_rw", "worker_rw", "analytics_ro"]
}

variable "tags" {
  type    = map(string)
  default = {}
}

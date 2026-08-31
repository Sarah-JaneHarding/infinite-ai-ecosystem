variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to reach Redis on 6379 — the ECS tasks' own security group."
  type        = list(string)
}

variable "node_type" {
  description = "cache.t4g.micro is ElastiCache's smallest Graviton class — a real starting point, not a load-tested conclusion (matches the database module's own sizing note)."
  type        = string
  default     = "cache.t4g.micro"
}

variable "multi_az" {
  description = "Automatic failover to a replica in a second AZ. Off for dev/staging; on for production."
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

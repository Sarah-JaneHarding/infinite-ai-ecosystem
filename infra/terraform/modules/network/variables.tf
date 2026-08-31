variable "name" {
  description = "Name prefix for every resource this module creates, e.g. \"infinite-ai-staging\"."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Sized /16 so each environment can grow without a re-plan."
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread subnets across. af-south-1 has three (af-south-1a/b/c); two is the practical minimum for RDS Multi-AZ and an ALB."
  type        = list(string)
  default     = ["af-south-1a", "af-south-1b"]
}

variable "single_nat_gateway" {
  description = "true = one NAT gateway shared by every private subnet (cheaper, single point of failure for outbound traffic — fine for dev/staging). false = one NAT gateway per AZ (production: an AZ outage does not take outbound internet with it)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to every resource this module creates."
  type        = map(string)
  default     = {}
}

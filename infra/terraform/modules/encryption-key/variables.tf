variable "name" {
  description = "Resource name, e.g. \"infinite-ai-staging-db-enc\". Used as the Secrets Manager secret name and the KMS alias."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

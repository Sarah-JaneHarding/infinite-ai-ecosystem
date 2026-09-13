variable "name" {
  description = "Resource name prefix, e.g. \"infinite-ai-staging-safeguarding\"."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

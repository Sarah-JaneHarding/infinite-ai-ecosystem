variable "name" {
  description = "Resource name prefix, e.g. \"infinite-ai-staging-ses\"."
  type        = string
}

variable "domain_name" {
  description = "The domain to verify with SES, e.g. \"infinite-ai.benjaminpine.co.za\". SES sends from no-reply@<domain_name>."
  type        = string
}

variable "dns_zone_id" {
  description = "Route53 hosted zone ID for var.domain_name. Used to create the DKIM CNAME records and SPF TXT record that SES requires for domain verification."
  type        = string
}

variable "mail_from_subdomain" {
  description = "Subdomain used as the MAIL FROM domain for DMARC alignment, e.g. \"mail\" → mail.<domain_name>. The default is appropriate for most deployments."
  type        = string
  default     = "mail"
}

variable "tags" {
  type    = map(string)
  default = {}
}

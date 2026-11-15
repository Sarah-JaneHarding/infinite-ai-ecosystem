variable "name" {
  description = "Budget name, e.g. \"infinite-ai-staging\". Unique within the account."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly cost limit in USD. No default on purpose: each environment states its own figure in its tfvars file, derived from docs/aws-cost-estimate.html, so a budget is never created with a number nobody chose."
  type        = number

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd must be greater than zero."
  }
}

variable "alert_emails" {
  description = "Recipients for every alert. At least one is required: a budget nobody is told about is not a safeguard."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) >= 1 && alltrue([for e in var.alert_emails : can(regex("^[^@\\s]+@[^@\\s]+$", e))])
    error_message = "alert_emails needs at least one address, and each must look like name@domain."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

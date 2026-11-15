variable "name" {
  description = "Budget name, e.g. \"infinite-ai-staging\". Unique within the account. Also names the alert topic (\"<name>-budget-alerts\")."
  type        = string
}

variable "monthly_budget_zar" {
  description = "Monthly cost limit in South African rand, the currency the business plans in. No default on purpose: each environment states its own figure in its tfvars file so a budget is never created with a number nobody chose. AWS measures cost in USD, so this is converted with zar_per_usd; see that variable."
  type        = number

  validation {
    condition     = var.monthly_budget_zar > 0
    error_message = "monthly_budget_zar must be greater than zero."
  }
}

variable "zar_per_usd" {
  description = "Rand per US dollar used to convert monthly_budget_zar into the USD limit AWS Budgets enforces. AWS reports cost in USD and does not convert, so a ZAR figure sent as-is would be compared against USD costs and alert far too late. The real limit therefore drifts with the exchange rate: update this when the rand moves materially. Required, with no default, so the assumption is always visible in the environment's tfvars."
  type        = number
  nullable    = false

  validation {
    condition     = var.zar_per_usd > 0
    error_message = "zar_per_usd must be greater than zero."
  }
}

variable "alert_emails" {
  description = "Operational recipients for every alert (the ops mailbox). At least one is required: a budget nobody is told about is not a safeguard. Personal recipients, such as the founder's email and phone, are NOT listed here: subscribe them to the alert topic (alert_topic_arn) so no personal contact detail is committed or stored in Terraform state. See docs/RUNBOOKS/aws-setup.md step 6."
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

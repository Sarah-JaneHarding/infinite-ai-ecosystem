variable "name_prefix" {
  description = "Path prefix for everything this module creates, e.g. \"/infinite-ai/staging\". Secrets are named \"<prefix>/<NAME>\" and parameters \"<prefix>/config/<NAME>\"."
  type        = string

  validation {
    condition     = startswith(var.name_prefix, "/") && !endswith(var.name_prefix, "/")
    error_message = "name_prefix must start with \"/\" and must not end with \"/\", e.g. \"/infinite-ai/staging\"."
  }
}

variable "secret_names" {
  description = "Names of secrets to create as EMPTY Secrets Manager shells, in env-var form (e.g. ANTHROPIC_API_KEYS). Values are set out-of-band with `aws secretsmanager put-secret-value`; this module never holds one."
  type        = set(string)
  default     = []

  validation {
    condition     = alltrue([for n in var.secret_names : can(regex("^[A-Z][A-Z0-9_]*$", n))])
    error_message = "Each secret name must be an upper-case env-var name (A-Z, 0-9, underscore; starting with a letter)."
  }
}

variable "ssm_config" {
  description = "Non-secret configuration to publish as SSM String parameters, name => value (e.g. AUTH_KEYCLOAK_ID). Anyone with ssm:GetParameter can read these, so credentials never belong here: keys that look like one are rejected."
  type        = map(string)
  default     = {}

  validation {
    condition = alltrue([
      for k in keys(var.ssm_config) :
      can(regex("^[A-Z][A-Z0-9_]*$", k)) && !can(regex("(?i)(SECRET|PASSWORD|TOKEN|API_?KEY|PRIVATE)", k))
    ])
    error_message = "ssm_config keys must be upper-case env-var names and must not look like credentials (SECRET, PASSWORD, TOKEN, API_KEY, PRIVATE). Credentials belong in secret_names."
  }
}

variable "recovery_window_in_days" {
  description = "Days a deleted secret stays recoverable. 7 is the AWS minimum with recovery; 30 is the maximum. 0 deletes immediately and is allowed only for throwaway environments."
  type        = number
  default     = 30

  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "recovery_window_in_days must be 0 or between 7 and 30."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

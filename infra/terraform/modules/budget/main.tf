# A monthly cost budget with email alerts, so the pilot's first bill is never a surprise.
#
# Alerts: 50%, 80% and 100% of ACTUAL spend, plus 100% of FORECASTED spend. The forecast
# alert is the early one: AWS projects month-end cost from the month so far, so it can fire
# well before the actual-spend thresholds if something is running away.
#
# AWS Budgets is a billing-plane service, not a regional one. Creating it needs budgets:*
# (the bootstrap deploy role's PowerUserAccess includes it). For non-root principals the
# account's "IAM user and role access to Billing information" setting may also need to be
# activated; docs/RUNBOOKS/aws-setup.md covers this and the matching spend limit in AWS
# Settings, which pauses the project rather than just emailing.

locals {
  notifications = [
    { type = "ACTUAL", threshold = 50 },
    { type = "ACTUAL", threshold = 80 },
    { type = "ACTUAL", threshold = 100 },
    { type = "FORECASTED", threshold = 100 },
  ]
}

resource "aws_budgets_budget" "this" {
  name         = var.name
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"

  dynamic "notification" {
    for_each = local.notifications

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = var.alert_emails
    }
  }

  tags = var.tags
}

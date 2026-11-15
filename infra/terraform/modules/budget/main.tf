# A monthly cost budget with alerts, so the pilot's first bill is never a surprise.
#
# Alerts: 50%, 80% and 100% of ACTUAL spend, plus 100% of FORECASTED spend. The forecast
# alert is the early one: AWS projects month-end cost from the month so far, so it can fire
# well before the actual-spend thresholds if something is running away.
#
# Currency. The business plans in rand, but AWS Budgets measures and reports cost in USD and
# does not convert. Sending a ZAR figure as the limit would compare it against USD costs and
# silently make every alert far too lenient. So the limit is stated in rand (monthly_budget_zar),
# converted with an explicit rate (zar_per_usd) and sent to AWS as USD. Both figures are exposed
# (budget_limit_usd output) so the conversion can be checked, and AWS's own alert emails will
# show USD amounts.
#
# Who is told. Every alert goes two ways: to alert_emails directly (the ops mailbox), and to an
# SNS topic. People are subscribed to the topic, not listed here: the founder's email address and
# mobile number are personal information, and putting them in a tfvars file or a Terraform
# variable would commit them to the repository or store them in state. Subscribe them once with
# the AWS CLI (docs/RUNBOOKS/aws-setup.md step 6); Terraform neither knows nor needs them.
#
# The topic is deliberately not encrypted: AWS Budgets cannot publish to a topic encrypted with
# the AWS-managed SNS key, and a customer-managed key would need a key policy for the Budgets
# service. The messages carry only cost figures and the budget name, no learner or personal data.
#
# AWS Budgets is a billing-plane service, not a regional one. Creating it needs budgets:*
# (the bootstrap deploy role's PowerUserAccess includes it). For non-root principals the
# account's "IAM user and role access to Billing information" setting may also need to be
# activated; docs/RUNBOOKS/aws-setup.md covers this and the matching spend limit in AWS
# Settings, which pauses the project rather than just emailing.

data "aws_caller_identity" "current" {}

locals {
  # Rounded DOWN to the cent so the effective limit is never above the rand figure.
  limit_usd = floor(var.monthly_budget_zar / var.zar_per_usd * 100) / 100

  notifications = [
    { type = "ACTUAL", threshold = 50 },
    { type = "ACTUAL", threshold = 80 },
    { type = "ACTUAL", threshold = 100 },
    { type = "FORECASTED", threshold = 100 },
  ]
}

resource "aws_sns_topic" "alerts" {
  name = "${var.name}-budget-alerts"

  tags = var.tags
}

# Only the AWS Budgets service, acting for budgets in this account, may publish to the topic.
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowBudgetsPublish"
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.alerts.arn
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        ArnLike      = { "aws:SourceArn" = "arn:aws:budgets::${data.aws_caller_identity.current.account_id}:*" }
      }
    }]
  })
}

resource "aws_budgets_budget" "this" {
  name         = var.name
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = format("%.2f", local.limit_usd)
  limit_unit   = "USD"

  dynamic "notification" {
    for_each = local.notifications

    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value.type
      subscriber_email_addresses = var.alert_emails
      subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
    }
  }

  # The policy must exist before AWS validates that Budgets can publish to the topic.
  depends_on = [aws_sns_topic_policy.alerts]

  tags = var.tags
}

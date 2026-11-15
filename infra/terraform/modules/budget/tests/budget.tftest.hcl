# Native `terraform test` for the budget module. Plan-only against a mocked AWS provider:
# nothing here contacts AWS. Run from the module directory:
#   terraform init -backend=false && terraform test

mock_provider "aws" {}

variables {
  name               = "infinite-ai-staging"
  monthly_budget_usd = 400
  alert_emails       = ["ops@example.com"]
}

run "four_notifications" {
  command = plan

  assert {
    condition     = length(aws_budgets_budget.this.notification) == 4
    error_message = "Expect 50/80/100 percent actual plus 100 percent forecast."
  }

  assert {
    condition     = length([for n in aws_budgets_budget.this.notification : n if n.notification_type == "FORECASTED"]) == 1
    error_message = "Exactly one forecast notification."
  }

  assert {
    condition     = length([for n in aws_budgets_budget.this.notification : n if n.notification_type == "ACTUAL"]) == 3
    error_message = "Exactly three actual-spend notifications."
  }

  assert {
    condition     = toset([for n in aws_budgets_budget.this.notification : n.threshold]) == toset([50, 80, 100])
    error_message = "Thresholds must be 50, 80 and 100 percent."
  }
}

run "limit_is_monthly_usd_cost" {
  command = plan

  assert {
    condition     = aws_budgets_budget.this.limit_amount == "400" && aws_budgets_budget.this.limit_unit == "USD"
    error_message = "limit_amount must be the variable, in USD."
  }

  assert {
    condition     = aws_budgets_budget.this.budget_type == "COST" && aws_budgets_budget.this.time_unit == "MONTHLY"
    error_message = "Must be a monthly cost budget."
  }
}

run "every_notification_reaches_every_recipient" {
  command = plan

  variables {
    alert_emails = ["ops@example.com", "owner@example.com"]
  }

  assert {
    condition = alltrue([
      for n in aws_budgets_budget.this.notification :
      toset(n.subscriber_email_addresses) == toset(["ops@example.com", "owner@example.com"])
    ])
    error_message = "Each notification must go to every recipient."
  }
}

run "rejects_zero_limit" {
  command = plan

  variables {
    monthly_budget_usd = 0
  }

  expect_failures = [var.monthly_budget_usd]
}

run "rejects_no_recipients" {
  command = plan

  variables {
    alert_emails = []
  }

  expect_failures = [var.alert_emails]
}

run "rejects_malformed_email" {
  command = plan

  variables {
    alert_emails = ["ops"]
  }

  expect_failures = [var.alert_emails]
}

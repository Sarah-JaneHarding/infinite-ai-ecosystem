# Native `terraform test` for the budget module, against a mocked AWS provider: nothing here
# contacts AWS, so even the `apply` runs create nothing real (they are needed because a new
# topic's ARN, and so the budget's notifications, are unknown until apply). The rejection runs
# are plan-only. Run from the module directory:
#   terraform init -backend=false && terraform test

mock_provider "aws" {}

# The mock provider invents a random string for a new topic's ARN, which the AWS provider
# rejects as an invalid ARN when the budget references it. Pin a well-formed one.
override_resource {
  target = aws_sns_topic.alerts
  values = {
    arn = "arn:aws:sns:af-south-1:111111111111:infinite-ai-staging-budget-alerts"
  }
}

variables {
  name               = "infinite-ai-staging"
  monthly_budget_zar = 10000
  zar_per_usd        = 18.5
  alert_emails       = ["ops@example.com"]
}

run "four_notifications" {
  command = apply

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

run "zar_limit_is_converted_to_usd" {
  command = apply

  assert {
    condition     = aws_budgets_budget.this.limit_unit == "USD"
    error_message = "AWS reports cost in USD, so the budget limit must be USD, never a ZAR number against USD costs."
  }

  assert {
    condition     = aws_budgets_budget.this.limit_amount == "540.54"
    error_message = "R10,000 at R18.50 per USD is $540.54 (rounded down to the cent)."
  }

  assert {
    condition     = output.budget_limit_usd == 540.54
    error_message = "budget_limit_usd must expose the converted limit so it can be checked against the ZAR figure."
  }

  assert {
    condition     = aws_budgets_budget.this.budget_type == "COST" && aws_budgets_budget.this.time_unit == "MONTHLY"
    error_message = "Must be a monthly cost budget."
  }
}

run "a_weaker_rand_lowers_the_usd_limit" {
  command = apply

  variables {
    zar_per_usd = 20
  }

  assert {
    condition     = aws_budgets_budget.this.limit_amount == "500.00"
    error_message = "R10,000 at R20 per USD is $500.00."
  }
}

run "every_notification_reaches_every_recipient" {
  command = apply

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

run "every_notification_also_publishes_to_the_alert_topic" {
  command = apply

  assert {
    condition     = alltrue([for n in aws_budgets_budget.this.notification : length(n.subscriber_sns_topic_arns) == 1])
    error_message = "Each notification must publish to the alert topic, so subscribers added to it (email, SMS) receive every alert."
  }

  assert {
    condition     = aws_sns_topic.alerts.name == "infinite-ai-staging-budget-alerts"
    error_message = "Topic is named after the budget."
  }
}

run "topic_policy_lets_only_this_accounts_budgets_publish" {
  command = apply

  assert {
    condition     = jsondecode(aws_sns_topic_policy.alerts.policy).Statement[0].Principal.Service == "budgets.amazonaws.com"
    error_message = "Only the AWS Budgets service may publish."
  }

  assert {
    condition     = jsondecode(aws_sns_topic_policy.alerts.policy).Statement[0].Action == "SNS:Publish"
    error_message = "Publish is the only action granted."
  }

  assert {
    condition     = jsondecode(aws_sns_topic_policy.alerts.policy).Statement[0].Condition.StringEquals["aws:SourceAccount"] == data.aws_caller_identity.current.account_id
    error_message = "Publishing must be restricted to this account's budgets (confused-deputy guard)."
  }
}

run "rejects_zero_budget" {
  command = plan

  variables {
    monthly_budget_zar = 0
  }

  expect_failures = [var.monthly_budget_zar]
}

run "rejects_non_positive_rate" {
  command = plan

  variables {
    zar_per_usd = 0
  }

  expect_failures = [var.zar_per_usd]
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

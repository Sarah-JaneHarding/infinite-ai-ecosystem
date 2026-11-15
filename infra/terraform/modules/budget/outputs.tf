output "budget_name" {
  description = "The budget's name, for a pipeline or runbook that needs to look it up (aws budgets describe-budget --budget-name <this>)."
  value       = aws_budgets_budget.this.name
}

output "budget_arn" {
  value = aws_budgets_budget.this.arn
}

output "budget_limit_usd" {
  description = "The monthly limit AWS enforces, in USD: monthly_budget_zar divided by zar_per_usd, rounded down to the cent."
  value       = local.limit_usd
}

output "alert_topic_arn" {
  description = "SNS topic every budget alert is published to. Subscribe the founder's email and mobile number to it with `aws sns subscribe` (docs/RUNBOOKS/aws-setup.md step 6); the email subscription must be confirmed by following the link AWS sends."
  value       = aws_sns_topic.alerts.arn
}

output "budget_name" {
  description = "The budget's name, for a pipeline or runbook that needs to look it up (aws budgets describe-budget --budget-name <this>)."
  value       = aws_budgets_budget.this.name
}

output "budget_arn" {
  value = aws_budgets_budget.this.arn
}

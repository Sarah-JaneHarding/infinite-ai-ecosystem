output "ecr_repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.this.name
}

output "service_name" {
  value = aws_ecs_service.this.name
}

output "target_group_arn" {
  description = "Null when attach_to_alb is false (e.g. apps/worker). The stack module wires this into the shared ALB's listener — a default action for the one service that should catch unmatched paths, a listener rule for the rest."
  value       = var.attach_to_alb ? aws_lb_target_group.this[0].arn : null
}

output "target_group_arn_suffix" {
  description = "For the observability module's CloudWatch alarms, which key on the target group's short arn_suffix, not its full ARN."
  value       = var.attach_to_alb ? aws_lb_target_group.this[0].arn_suffix : null
}

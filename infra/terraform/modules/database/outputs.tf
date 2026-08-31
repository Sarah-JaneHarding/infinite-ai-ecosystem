output "endpoint" {
  value = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "db_name" {
  value = local.db_name
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "app_role_secret_arns" {
  description = "Secrets Manager ARN per role name, e.g. { app_rw = \"arn:...\" } — pass into the ecs-service module's `secrets` var so a task definition can pull DATABASE_URL at boot without ever putting it in plain task-def JSON."
  value       = { for role, secret in aws_secretsmanager_secret.app_role : role => secret.arn }
}

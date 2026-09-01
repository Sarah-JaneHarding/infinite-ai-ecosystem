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

output "master_user_secret_arn" {
  description = "The RDS-managed master-user credential (username/password/dbname fields, AWS's own JSON shape) — for a caller with no app_role_names at all (var.app_role_names = []), meaning this instance is dedicated to one piece of software that manages its own schema, rather than shared across the migrator/app_rw/worker_rw/analytics_ro split every other consumer of this module uses. Null is never returned in that case — manage_master_user_password is always true, so the secret always exists; this output just exposes its ARN."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

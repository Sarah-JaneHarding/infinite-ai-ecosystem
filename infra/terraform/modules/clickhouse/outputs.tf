output "private_ip" {
  value = aws_instance.this.private_ip
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "http_url" {
  description = "CLICKHOUSE_URL, Langfuse's own env var name for this."
  value       = "http://${aws_instance.this.private_ip}:8123"
}

output "native_url" {
  description = "CLICKHOUSE_MIGRATION_URL — the native protocol port Langfuse's own migrations use."
  value       = "clickhouse://${aws_instance.this.private_ip}:9000"
}

output "credentials_secret_arn" {
  description = "{ user, password } — pass into the ecs-service module's `secrets` var with a \":user::\"/\":password::\" suffix."
  value       = aws_secretsmanager_secret.credentials.arn
}

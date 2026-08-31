output "primary_endpoint_address" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "redis_url_secret_arn" {
  value = aws_secretsmanager_secret.redis_url.arn
}

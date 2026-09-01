output "web_url" {
  value = local.web_url
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "otlp_endpoint" {
  description = "OTEL_EXPORTER_OTLP_ENDPOINT — plain, not secret; modules/stack wires this into gateway/worker's environment."
  value       = local.otlp_endpoint
}

output "otlp_header_secret_arn" {
  description = "{ header, public_key, secret_key } — modules/stack reads the \":header::\" field into gateway/worker's OTEL_EXPORTER_OTLP_HEADERS secret."
  value       = aws_secretsmanager_secret.otlp.arn
}

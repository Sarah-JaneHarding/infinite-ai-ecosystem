output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "gateway_ecr_repository_url" {
  value = module.ecs_service_gateway.ecr_repository_url
}

output "worker_ecr_repository_url" {
  value = module.ecs_service_worker.ecr_repository_url
}

output "web_ecr_repository_url" {
  value = module.ecs_service_web.ecr_repository_url
}

output "database_endpoint" {
  value = module.database.endpoint
}

output "object_store_bucket_name" {
  value = module.object_store.bucket_name
}

output "bootstrap_roles_command" {
  description = "The one manual step this stack cannot run itself — see modules/database/bootstrap-roles.sh's own header for why."
  value       = "./modules/database/bootstrap-roles.sh ${var.name}-db"
}

output "langfuse_web_url" {
  value = module.langfuse.web_url
}

output "safeguarding_sns_topic_arn" {
  description = "ARN of the safeguarding escalation SNS topic. Use this to add subscriptions (SMS, email, PagerDuty) in the AWS console per pilot school. The worker's SAFEGUARDING_SNS_TOPIC_ARN env var is set to this value automatically."
  value       = module.sns_escalation.topic_arn
}

output "db_encryption_key_secret_arn" {
  description = "ARN of the empty DB_ENCRYPTION_KEY Secrets Manager secret. Populate it before processing real learner data: aws secretsmanager put-secret-value --secret-id <this ARN> --secret-string \"$(openssl rand -base64 32)\""
  value       = module.encryption_key.secret_arn
}

output "ses_from_domain" {
  description = "The SES-verified sending domain, or null when domain_name is not set. Set SES_FROM_ADDRESS to no-reply@<this value> in apps/gateway's own email configuration."
  value       = var.domain_name == null ? null : module.ses[0].from_domain
}

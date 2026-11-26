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

output "app_secret_arns" {
  description = "Secret name => Secrets Manager ARN for ANTHROPIC_API_KEYS, NEXTAUTH_SECRET and AUTH_KEYCLOAK_SECRET (all created empty — see docs/RUNBOOKS/aws-setup.md for populating them). DB_ENCRYPTION_KEY is separate: db_encryption_key_secret_arn."
  value       = module.app_secrets.secret_arns
}

output "app_config_parameter_arns" {
  description = "Config name => SSM parameter ARN (AUTH_KEYCLOAK_ID when keycloak_client_id is set)."
  value       = module.app_secrets.ssm_parameter_arns
}

output "gateway_execution_role_arn" {
  value = module.ecs_service_gateway.execution_role_arn
}

output "gateway_task_role_arn" {
  value = module.ecs_service_gateway.task_role_arn
}

output "worker_execution_role_arn" {
  value = module.ecs_service_worker.execution_role_arn
}

output "worker_task_role_arn" {
  value = module.ecs_service_worker.task_role_arn
}

output "web_execution_role_arn" {
  value = module.ecs_service_web.execution_role_arn
}

output "web_task_role_arn" {
  value = module.ecs_service_web.task_role_arn
}

output "budget_name" {
  description = "The monthly cost budget's name, or null when monthly_budget_zar is not set."
  value       = length(module.budget) == 0 ? null : module.budget[0].budget_name
}

output "budget_limit_usd" {
  description = "The monthly limit AWS enforces, in USD (monthly_budget_zar / zar_per_usd, rounded down to the cent), or null when no budget is set. Check it against the rand figure."
  value       = length(module.budget) == 0 ? null : module.budget[0].budget_limit_usd
}

output "budget_alert_topic_arn" {
  description = "SNS topic every budget alert is published to, or null when no budget is set. Subscribe the founder's email and mobile number to it with `aws sns subscribe` (docs/RUNBOOKS/aws-setup.md step 6). The email subscription is inactive until its confirmation link is followed, and the SMS destination must be verified while the account is in the SNS SMS sandbox."
  value       = length(module.budget) == 0 ? null : module.budget[0].alert_topic_arn
}

output "ses_from_domain" {
  description = "The SES-verified sending domain, or null when domain_name is not set. Set SES_FROM_ADDRESS to no-reply@<this value> in apps/gateway's own email configuration."
  value       = local.domain_name == null ? null : module.ses[0].from_domain
}

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

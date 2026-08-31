output "alb_dns_name" {
  value = module.stack.alb_dns_name
}

output "gateway_ecr_repository_url" {
  value = module.stack.gateway_ecr_repository_url
}

output "worker_ecr_repository_url" {
  value = module.stack.worker_ecr_repository_url
}

output "web_ecr_repository_url" {
  value = module.stack.web_ecr_repository_url
}

output "bootstrap_roles_command" {
  value = module.stack.bootstrap_roles_command
}

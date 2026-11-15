output "secret_arns" {
  description = "Secret name => Secrets Manager ARN. Pass an entry in an ecs-service `secrets` map (env-var name => ARN); the service's execution role is granted exactly that ARN. Populate each value with `aws secretsmanager put-secret-value` before the first deployment."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "ssm_parameter_arns" {
  description = "Config name => SSM parameter ARN. Pass an entry in an ecs-service `secrets` map; the execution role is granted ssm:GetParameters on exactly that ARN."
  value       = { for name, parameter in aws_ssm_parameter.config : name => parameter.arn }
}

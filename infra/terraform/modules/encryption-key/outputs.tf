output "secret_arn" {
  description = "ARN of the Secrets Manager secret holding DB_ENCRYPTION_KEY. Pass this in the worker and web ecs-service `secrets` map. The ecs-service module automatically grants secretsmanager:GetSecretValue on this ARN to the ECS execution role. Populate the secret value with `aws secretsmanager put-secret-value` before the first deployment that processes real learner data — the app refuses to start without it (packages/config/src/env.ts)."
  value       = aws_secretsmanager_secret.this.arn
}

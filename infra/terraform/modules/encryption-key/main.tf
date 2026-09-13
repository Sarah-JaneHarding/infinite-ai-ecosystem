# Secrets Manager placeholder for DB_ENCRYPTION_KEY — the application-level AES key
# used by apps/worker and apps/web to encrypt learner identifiers in the Infinite Brain
# before they are stored in Postgres (rule 4: no learner PII at rest without encryption).
#
# This module creates an empty secret. The actual key value MUST be set by an operator
# before the first deployment that processes real learner data:
#
#   aws secretsmanager put-secret-value \
#     --secret-id <db_encryption_key_secret_arn output> \
#     --secret-string "$(openssl rand -base64 32)"
#
# Never set the key value in Terraform. HCL values appear in plans, CI logs, and state
# files — even in a remote state backend, a plaintext key in HCL violates rule 7 (no
# secrets in the repository). The empty secret surfaces the ARN so ECS task definitions
# can reference it before the key is populated; the app validates at startup that the env
# var is non-empty (packages/config/src/env.ts uses z.string().min(1).optional()).
#
# Recovery window: 30 days. Losing this key means re-encrypting every Brain record in
# every tenant's database — a multi-hour irreversible operation. The window is deliberate
# insurance against an accidental `terraform destroy`.
#
# Encryption: Secrets Manager's own managed key (aws/secretsmanager) is used rather than
# a CMK, because the ECS execution role needs kms:Decrypt at container-start time to read
# secrets, and the managed key's own policy grants this through the normal IAM chain
# without requiring a separate inline-policy amendment to every ecs-service execution
# role. A CMK would be the right choice if cross-account access or custom key rotation
# logic were needed — neither applies here.

resource "aws_secretsmanager_secret" "this" {
  name        = var.name
  description = "Application-level encryption key for apps/worker and apps/web learner identifier encryption. Set with `aws secretsmanager put-secret-value` — never configure the value in Terraform."

  # Default managed key (aws/secretsmanager) — see module header for why not a CMK.
  # kms_key_id is intentionally omitted.

  recovery_window_in_days = 30

  tags = var.tags
}

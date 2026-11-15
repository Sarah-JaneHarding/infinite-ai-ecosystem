# Runtime secrets and plain config the three deployables need that no other module owns
# (provider API keys, web auth secrets, the Keycloak client id), under one path convention:
#
#   Secrets Manager   <name_prefix>/<NAME>           e.g. /infinite-ai/staging/ANTHROPIC_API_KEYS
#   SSM Parameter     <name_prefix>/config/<NAME>    e.g. /infinite-ai/staging/config/AUTH_KEYCLOAK_ID
#
# Secrets are created EMPTY, the same pattern as modules/encryption-key. The value is set by
# an operator after `apply`:
#
#   aws secretsmanager put-secret-value \
#     --secret-id <secret_arns output> \
#     --secret-string "$(openssl rand -base64 32)"        # or a silent prompt for a real key
#
# Never set a value in Terraform. HCL values appear in plans, CI logs and state files, so a
# credential in HCL violates rule 7 (no secrets in the repository) even with a private
# backend. This module therefore declares no aws_secretsmanager_secret_version at all.
#
# Until a secret has a value, an ECS task that references it cannot start and stops with
# `ResourceInitializationError`. That is expected on a from-scratch environment: populate
# the secrets, then force a new deployment (docs/RUNBOOKS/aws-setup.md).
#
# Secrets Manager (not SSM) holds credentials: per-secret resource policies, versioning and
# rotation support, at a few dollars a month. SSM standard-tier String parameters are free
# and hold only what is safe for any reader of the account to see.
#
# Encryption: Secrets Manager's own managed key (aws/secretsmanager), for the reason recorded
# in modules/encryption-key/main.tf — the ECS execution role reads it through the normal IAM
# chain with no key-policy amendment per service. Revisit with a CMK if cross-account access
# or custom rotation is needed.

resource "aws_secretsmanager_secret" "this" {
  for_each = var.secret_names

  name        = "${var.name_prefix}/${each.key}"
  description = "Runtime secret ${each.key}. Set with `aws secretsmanager put-secret-value`; never configure the value in Terraform."

  # Default managed key (aws/secretsmanager): kms_key_id is intentionally omitted.

  recovery_window_in_days = var.recovery_window_in_days

  tags = var.tags
}

resource "aws_ssm_parameter" "config" {
  for_each = var.ssm_config

  name        = "${var.name_prefix}/config/${each.key}"
  description = "Non-secret configuration ${each.key}."
  type        = "String"
  value       = each.value

  tags = var.tags
}

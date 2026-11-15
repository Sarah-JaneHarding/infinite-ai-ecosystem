# Non-secret, per-environment values for staging. Applied with:
#   terraform plan  -var-file=staging.tfvars -var langfuse_init_user_email=<email> -var alert_email=<email>
# Never put a credential here: secret values are set with `aws secretsmanager put-secret-value`
# (docs/RUNBOOKS/aws-setup.md). scripts/ci/check-terraform-secrets.sh enforces this in CI.
#
# Values CI supplies through TF_VAR_* (domain_name, dns_zone_id, alert_email, image tags,
# langfuse_init_user_email) are deliberately NOT set here: a tfvars value would override them.

# PROPOSED — confirm before apply (docs/OPEN_QUESTIONS.md).
# Basis: docs/aws-cost-estimate.html puts the shared baseline (ECS Fargate x3, RDS, cache,
# ALB, NAT, CloudWatch, Secrets Manager) at R5,180-R7,770/month = ~$280-$420 at R18.50/USD.
# Staging uses the upper end: $420 x 1.2 headroom = $504, rounded up to $550.
# That estimate predates the self-hosted Langfuse stack (ClickHouse node, its own RDS, cache
# and ALB) and excludes LLM spend, so expect to revisit this after the first month's actuals.
monthly_budget_usd = 550

# alert_email (TF_VAR_alert_email) always receives budget alerts. Add more recipients here.
# budget_alert_emails = []

# From infra/keycloak/realm.json. Change it if the real Keycloak realm uses another client id.
keycloak_client_id = "infinite-ai-web"

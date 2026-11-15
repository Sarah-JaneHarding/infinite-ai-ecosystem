# Non-secret, per-environment values for production. Applied with:
#   terraform plan  -var-file=production.tfvars   (CI does this; see .github/workflows/terraform.yml)
# Never put a credential here: secret values are set with `aws secretsmanager put-secret-value`
# (docs/RUNBOOKS/aws-setup.md). scripts/ci/check-terraform-secrets.sh enforces this in CI.
#
# Values CI supplies through TF_VAR_* (domain_name, dns_zone_id, alert_email, image tags,
# langfuse_init_user_email) are deliberately NOT set here: a tfvars value would override them.

# PROPOSED — confirm before apply (docs/OPEN_QUESTIONS.md).
# Basis: docs/aws-cost-estimate.html puts the shared baseline at ~$280-$420/month. Production
# adds the estimate's own high-availability caveats: db.t4g.large Multi-AZ (+~$120) and a NAT
# gateway per AZ (+~$32), so $420 + $152 = $572. x 1.2 headroom = $686, rounded up to $700.
# That estimate predates the self-hosted Langfuse stack and excludes LLM spend, so expect to
# revisit this after the first month's actuals.
monthly_budget_usd = 700

# alert_email (TF_VAR_ALERT_EMAIL, required in CI) always receives budget alerts. Add more here.
# budget_alert_emails = []

# From infra/keycloak/realm.json. Change it if the real Keycloak realm uses another client id.
keycloak_client_id = "infinite-ai-web"

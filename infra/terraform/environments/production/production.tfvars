# Non-secret, per-environment values for production. Applied with:
#   terraform plan  -var-file=production.tfvars   (CI does this; see .github/workflows/terraform.yml)
# Never put a credential here: secret values are set with `aws secretsmanager put-secret-value`
# (docs/RUNBOOKS/aws-setup.md). scripts/ci/check-terraform-secrets.sh enforces this in CI.
#
# Values CI supplies through TF_VAR_* (domain_name, dns_zone_id, alert_email, image tags,
# langfuse_init_user_email) are deliberately NOT set here: a tfvars value would override them.

# PROVISIONAL (owner decision, 2026-11-15): budgets are in rand, and stay as set until the full
# business load has been tested, then are reset from the real bill (docs/OPEN_QUESTIONS.md OQ-050,
# load test OQ-017).
# Basis: docs/aws-cost-estimate.html puts the shared baseline at R5,180-R7,770 a month. Production
# adds that estimate's own high-availability caveats: db.t4g.large Multi-AZ (+R2,220) and a NAT
# gateway per AZ (+R592), so R7,770 + R2,220 + R592 = R10,582. x 1.2 headroom = R12,698, rounded up
# to R13,000. That estimate predates the self-hosted Langfuse stack and excludes LLM spend, so
# expect to revisit it.
monthly_budget_zar = 13000

# AWS Budgets measures cost in USD and does not convert, so Terraform sends AWS
# monthly_budget_zar / zar_per_usd (here R13,000 / 18.50 = $702.70). The cost estimate assumes R18.50
# = $1. If the rand moves materially, update this: the effective rand limit moves with it.
zar_per_usd = 18.5

# alert_email (TF_VAR_ALERT_EMAIL, required in CI) always receives budget alerts. Add more
# OPERATIONAL (shared mailbox) recipients here. Never a person's email or phone: the founder is
# subscribed to the budget alert topic by hand (docs/RUNBOOKS/aws-setup.md step 6), so no personal
# contact detail is committed or held in Terraform state.
# budget_alert_emails = []

# From infra/keycloak/realm.json. Change it if the real Keycloak realm uses another client id.
keycloak_client_id = "infinite-ai-web"

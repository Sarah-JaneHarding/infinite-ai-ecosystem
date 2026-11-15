# AWS setup, apply and secret injection

Owner: whoever holds the AWS account (today, the single operator). Region: `af-south-1`
(Cape Town) — data residency is a POPIA requirement (`infra/terraform/README.md`).

This walks one environment from an empty machine to a running task that has its secrets
injected. Everything below was **written, not run**: the authoring session had no AWS
credentials. Commands that only read are marked _(read-only)_. Replace `staging` with
`production` for the other environment; staging is where you rehearse first.

> **Never** paste a secret value into a chat, a ticket, a shell history line or a `.tf`
> or `.tfvars` file. Every `put-secret-value` below reads the value from a silent prompt
> or generates it.

## 1. Install the AWS CLI v2

Follow AWS's installer for your OS:
<https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>

```bash
aws --version        # expect: aws-cli/2.x ...
```

Also install Terraform `1.9.x` (CI pins `1.9.8`) and `jq`.

## 2. Credentials and region

```bash
aws configure --profile infinite-ai
#   AWS Access Key ID / Secret Access Key: use the credential method AWS gives you
#   Default region name: af-south-1
#   Default output format: json
export AWS_PROFILE=infinite-ai AWS_REGION=af-south-1
```

If the account uses the new AWS experience (social sign-in), confirm the Region in
**AWS Settings → View all projects → Overview → Additional info → Region**. All of a
project's resources live in that one Region; it must read `af-south-1`. Use whichever
credential method AWS Settings offers in place of long-lived access keys where it does.

## 3. Verify who you are _(read-only)_

```bash
aws sts get-caller-identity
# expect JSON with your Account and an Arn — confirm it is the account you mean to change
```

## 4. Confirm the Region and services exist — do not assume _(read-only)_

`af-south-1` is an **opt-in** Region. Check it is enabled, then check the services this
stack uses are offered there:

```bash
aws account get-region-opt-status --region-name af-south-1
# expect RegionOptStatus ENABLED or ENABLED_BY_DEFAULT

aws ssm get-parameters-by-path --region af-south-1 \
  --path /aws/service/global-infrastructure/regions/af-south-1/services \
  --recursive --query 'Parameters[].Name' --output text | tr '\t' '\n' \
  | grep -E '/(secretsmanager|ssm|ecs|rds|elasticache|budgets)$'
```

Every one of `secretsmanager`, `ssm`, `ecs` (which covers Fargate), `rds` and `elasticache`
should be listed. (`budgets` is a billing-plane service and may not be listed per Region; Step 6
covers it.) A missing service is a stop: record it in `docs/OPEN_QUESTIONS.md` rather than
working around it.

## 5. State backend

Terraform state lives in the S3 bucket and DynamoDB lock table that `bootstrap/` creates
once, by hand. Do that first: `infra/terraform/README.md`, "Applying this for real", step

1. Then, per environment:

```bash
cd infra/terraform/environments/staging
cp backend.hcl.example backend.hcl      # fill in the bootstrap outputs; gitignored
terraform init -backend-config=backend.hcl
```

**Treat state as sensitive.** Several existing modules (cache, Langfuse, ClickHouse and the
database app roles) generate passwords that Terraform stores in state. Whoever can read the
state bucket can read those secrets. The new secrets from `app-secrets` are different: they
are empty shells, so their values never enter state.

## 6. Budget and spend limit

The monthly budget is created by Terraform from `monthly_budget_usd` in
`staging.tfvars` / `production.tfvars` (alerts at 50%, 80% and 100% of actual spend and at
100% of forecast, emailed to `alert_email` plus `budget_alert_emails`). The figures in
those files are **proposals** — confirm them first (`docs/OPEN_QUESTIONS.md`).

Two things Terraform cannot do for you:

- **Spend limit.** If your project has a spend limit (paid plan), set or check it in
  **AWS Settings → Billing**. A budget only emails; a spend limit pauses the project.
- **Billing access for the apply role.** If `apply` is refused on `budgets:*`, a
  non-root role may need the account setting **IAM user and role access to Billing
  information** activated (root user, Account settings). Do that, then re-apply.

## 7. Plan and apply

```bash
terraform plan  -var-file=staging.tfvars \
  -var alert_email=<ops address> -var langfuse_init_user_email=<admin address>
terraform apply -var-file=staging.tfvars \
  -var alert_email=<ops address> -var langfuse_init_user_email=<admin address>
```

`alert_email` must be set: the budget module refuses to create a budget with no recipient.
The first `apply` leaves every service unable to start (no image pushed yet, and secrets
still empty) — expected. Then follow `infra/terraform/README.md` steps 3 and 4 (database
roles, migrations).

Optional, before applying — scan the new Terraform locally (not run in the authoring
session):

```bash
checkov -d infra/terraform --framework terraform
```

## 8. Populate the secrets

A task whose secret has no value stops with `ResourceInitializationError`. Set each value
once, then redeploy. `ENV=staging`:

```bash
ENV=staging

# Provider key pool (comma-separated if you have several). Silent prompt, nothing in history.
read -rs -p "ANTHROPIC_API_KEYS: " VAL; echo
aws secretsmanager put-secret-value --secret-id /infinite-ai/$ENV/ANTHROPIC_API_KEYS --secret-string "$VAL"
unset VAL

# Random values — generated, never typed.
aws secretsmanager put-secret-value --secret-id /infinite-ai/$ENV/NEXTAUTH_SECRET \
  --secret-string "$(openssl rand -base64 32)"
aws secretsmanager put-secret-value --secret-id "$(terraform output -raw db_encryption_key_secret_arn)" \
  --secret-string "$(openssl rand -base64 32)"

# Must equal the Keycloak web client's secret (infinite-ai-web). Copy it from Keycloak.
read -rs -p "AUTH_KEYCLOAK_SECRET: " VAL; echo
aws secretsmanager put-secret-value --secret-id /infinite-ai/$ENV/AUTH_KEYCLOAK_SECRET --secret-string "$VAL"
unset VAL
```

**Keep a safe copy of `DB_ENCRYPTION_KEY`.** Losing it makes every encrypted learner
identifier unreadable. Do not generate a second one later to "fix" a problem.

Then redeploy so tasks pick the values up:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
for svc in gateway worker web; do
  aws ecs update-service --cluster "$CLUSTER" --service "$CLUSTER-$svc" --force-new-deployment >/dev/null
done
```

## 9. Prove the secrets are injected

Run for each service (`gateway`, `worker`, `web`); `CLUSTER` as above.

```bash
# 1. The task definition names secrets under "secrets" with a valueFrom ARN — and the
#    secret names must NOT appear under "environment".
aws ecs describe-task-definition --task-definition "$CLUSTER-gateway" \
  --query 'taskDefinition.containerDefinitions[0].{env:environment[].name,secrets:secrets[].[name,valueFrom]}'
# expect: ANTHROPIC_API_KEYS only under secrets, as /infinite-ai/staging/ANTHROPIC_API_KEYS-xxxxxx

# 2. The task is running, not stopped on a secret error.
TASK=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$CLUSTER-gateway" --query 'taskArns[0]' --output text)
aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" \
  --query 'tasks[0].[lastStatus,stoppedReason]'
# expect: RUNNING and null. A stoppedReason mentioning ResourceInitializationError = see the table.

# 3. No startup errors in the logs.
aws logs tail "/ecs/$CLUSTER-gateway" --since 15m

# 4. The service answers through the load balancer.
curl -fsS "http://$(terraform output -raw alb_dns_name)/health"
```

Expected per service: `gateway` shows `ANTHROPIC_API_KEYS`; `web` shows `NEXTAUTH_SECRET`,
`AUTH_KEYCLOAK_SECRET`, `DB_ENCRYPTION_KEY` and `AUTH_KEYCLOAK_ID`; `worker` shows
`DB_ENCRYPTION_KEY` and **not** `ANTHROPIC_API_KEYS` (provider keys are gateway-only).
Values never appear in any of this output; if one does, stop and treat it as exposed.

## 10. When something is wrong

| Symptom                                                                       | Likely cause                                                                      | Fix                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `stoppedReason` has `ResourceInitializationError … unable to retrieve secret` | The secret exists but has no value yet                                            | Step 8 for that secret, then force a new deployment                                                      |
| Same error, but the secret has a value                                        | Execution role lacks the ARN, or the ARN in the task definition is wrong          | `aws iam get-role-policy --role-name $CLUSTER-<svc>-execution --policy-name $CLUSTER-<svc>-read-secrets` |
| `AccessDeniedException` on `GetSecretValue` or `GetParameters`                | ARN mismatch between the task definition and the execution role policy            | Re-apply; the policy is derived from the same `secrets` map                                              |
| `terraform apply` refused on `budgets:*`                                      | Billing access for non-root roles is off                                          | Step 6                                                                                                   |
| `plan` fails: "alert_emails needs at least one address"                       | `monthly_budget_usd` is set but no `alert_email` was passed                       | Pass `-var alert_email=…`                                                                                |
| Tasks start but `web` sign-in fails                                           | `AUTH_KEYCLOAK_SECRET` does not match Keycloak, or `keycloak_issuer_url` is unset | Step 8; set `keycloak_issuer_url` once a real realm exists                                               |

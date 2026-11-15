# Secrets, task IAM and budget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every runtime secret into the ECS Fargate stack through native ECS injection, add pilot-scoped task IAM and an AWS Budget, and document the AWS setup, apply and rotation procedures.

**Architecture:** Extend `infra/terraform/` in place. Two new modules (`app-secrets`, `budget`), backwards-compatible additions to `modules/ecs-service`, wiring in `modules/stack`, `<env>.tfvars` files, and CI changes so the files are actually loaded. Tested with native `terraform test` (mock provider, `command = plan`), run in the existing Lint job.

**Tech Stack:** Terraform `>= 1.5` modules (CI pins `1.9.8`; `mock_provider` needs `>= 1.7`), AWS provider `~> 5.0`, GitHub Actions, Markdown runbooks.

**Spec:** `docs/superpowers/specs/2026-11-15-secrets-iam-budget-design.md` (approved 2026-11-15).

## Global Constraints

- Region `af-south-1` only; no cross-region resources; no Cognito; identity stays Keycloak.
- No secret value in any `.tf`, `.tfvars`, doc or fixture. New secrets are empty `aws_secretsmanager_secret` shells with **no** `aws_secretsmanager_secret_version`.
- Secret names `/infinite-ai/<env>/<NAME>`; SSM parameters `/infinite-ai/<env>/config/<NAME>`, type `String`.
- AWS-managed key `aws/secretsmanager` (no `kms_key_id`).
- No `"*"` action or resource, and no `service:*` action, in any IAM statement this plan adds.
- Provider credentials (`ANTHROPIC_API_KEYS`) go to the **gateway only** (CLAUDE.md rule 3; confirmed: only `apps/gateway` and `packages/config` read it).
- Existing callers of `ecs-service` must plan identically (same resource addresses, same SM-only policy content).
- Do not touch `bootstrap/`.
- Keep the repo directory name `production`; tfvars are `staging.tfvars` and `production.tfvars`.
- Commits: Conventional Commits, one logical change each. End every commit message with these two lines, exactly as earlier commits on this branch:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01JBA6pGPTBSsb7GXCbZgZ4c`.
- Markdown must pass `node_modules/.bin/prettier --check`. `.tf` must pass `terraform fmt -check -recursive infra/terraform` (CI Lint). No `terraform` binary exists in the authoring sandbox: write HCL with 2-space indent and `=` aligned within each block, and treat CI Lint on the draft PR as the verifier.
- Nothing is applied to AWS from this plan. Report unrun checks as unverified.

## Review Focus

1. A secret name that is not a valid env-var name (`lower-case`, spaces, empty) → module rejects it (Task 2 test).
2. An `ssm_config` key that looks like a credential (`..._SECRET`, `..._TOKEN`, `..._PASSWORD`, `..._API_KEY`) → rejected, because SSM `String` values are readable by anyone with `ssm:GetParameter` (Task 2 test).
3. A `secrets` ARN with a JSON-key suffix or a slash-named secret → execution role still gets the base ARN, never the suffixed string; a mixed Secrets Manager + SSM map gets two correctly-scoped statements (Task 1 test).
4. Budget with no recipients or a non-positive limit → rejected loudly instead of creating a silent, useless budget (Task 3 test).
5. Tasks started before a secret has a value fail with `ResourceInitializationError`; the runbook says so and gives the populate-then-redeploy order (Task 6 runbook step, human-verified).

---

### Task 1: `ecs-service` — SSM-aware execution policy, inline task policy, role outputs

**Files:**

- Modify: `infra/terraform/modules/ecs-service/main.tf` (locals block and `execution_secrets` policy at lines 69-96; add task inline policy after `task_extra` at 105-110)
- Modify: `infra/terraform/modules/ecs-service/variables.tf` (add `task_policy_statements` after `iam_policy_arns`)
- Modify: `infra/terraform/modules/ecs-service/outputs.tf` (add `execution_role_arn`)
- Create: `infra/terraform/modules/ecs-service/tests/iam.tftest.hcl`

**Interfaces:**

- Consumes: existing `var.secrets` (map env-name → ARN, optional `:json-key::` suffix), `var.iam_policy_arns`.
- Produces:
  - `variable "task_policy_statements"`: `list(object({ sid = string, actions = list(string), resources = list(string) }))`, default `[]`. Validation: no `actions` entry equals `"*"` or ends with `":*"`; no `resources` entry equals `"*"`; `sid` matches `^[A-Za-z0-9]+$`.
  - `output "execution_role_arn"` = `aws_iam_role.execution.arn`.
  - `aws_iam_role_policy.execution_secrets[0].policy` is a `jsonencode` string with Secrets Manager statement first (action `secretsmanager:GetSecretValue`, no `Sid`, resources = distinct base ARNs), then, only if any value starts with `arn:aws:ssm:`, a second statement (action `ssm:GetParameters`, resources = those exact ARNs).
  - `aws_iam_role_policy.task_inline[0]`, `count = length(var.task_policy_statements) > 0 ? 1 : 0`, name `"${var.name}-task-inline"`.

- [ ] **Step 0: Probe tooling.** Run `which terraform; curl -sI --max-time 10 https://releases.hashicorp.com | head -1`. If a binary can be obtained, install it to the scratchpad and use it for fmt/validate/test below; if not, record "terraform unavailable; verified by CI Lint only" and carry on.

- [ ] **Step 1: Write the failing test** `tests/iam.tftest.hcl` with `mock_provider "aws" {}`, shared `variables` (name `t-gw`, `cluster_id`, `cluster_name`, `vpc_id`, `security_group_id`, `private_subnet_ids = ["subnet-1"]`, `container_port = 8080`) and these `run` blocks, all `command = plan`:
  - `sm_only_matches_existing_policy`: `secrets = { DATABASE_URL = "arn:aws:secretsmanager:af-south-1:111111111111:secret:db-AbCdEf:url::" }`. Assert `jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement` has length 1, its `Resource` equals `["arn:aws:secretsmanager:af-south-1:111111111111:secret:db-AbCdEf"]`, and `length(aws_iam_role_policy.task_inline) == 0`.
  - `slash_named_secret_keeps_base_arn`: ARN `arn:aws:secretsmanager:af-south-1:111111111111:secret:/infinite-ai/staging/ANTHROPIC_API_KEYS-AbCdEf`. Assert that exact ARN is the sole resource.
  - `ssm_gets_its_own_statement`: one SM ARN plus `AUTH_KEYCLOAK_ID = "arn:aws:ssm:af-south-1:111111111111:parameter/infinite-ai/staging/config/AUTH_KEYCLOAK_ID"`. Assert two statements; second has `Action == "ssm:GetParameters"` and that ARN as sole resource.
  - `no_secrets_no_policy`: `secrets = {}`; assert `length(aws_iam_role_policy.execution_secrets) == 0`.
  - `inline_task_policy_created`: one valid statement (`sid = "ReadBrainSnapshots"`, `actions = ["s3:GetObject"]`, `resources = ["arn:aws:s3:::bucket/*"]`); assert `length(aws_iam_role_policy.task_inline) == 1`.
  - `rejects_wildcard_action`, `rejects_service_wildcard_action` (`"s3:*"`), `rejects_wildcard_resource`, `rejects_bad_sid`: each with `expect_failures = [var.task_policy_statements]`.

- [ ] **Step 2: Run to verify it fails.** `terraform -chdir=infra/terraform/modules/ecs-service init -backend=false && terraform -chdir=infra/terraform/modules/ecs-service test`. Expected: FAIL (`task_inline` and `task_policy_statements` undeclared; `policy` is currently a data-source JSON, not asserted shape). If no binary, skip and note it.

- [ ] **Step 3: Implement** the variable, the two-statement `jsonencode` policy (replace the `aws_iam_policy_document.execution_secrets` data source; keep resource `aws_iam_role_policy.execution_secrets` address and `count`), the `task_inline` resource, and the output. Split `var.secrets` values by prefix (`arn:aws:secretsmanager:` vs `arn:aws:ssm:`); keep the existing 7-field truncation for Secrets Manager ARNs only. Update the comment above the locals to say SSM is now handled and why SSM ARNs are not truncated.

- [ ] **Step 4: Run tests** as in Step 2. Expected: all `run` blocks PASS. Also `terraform fmt -check -recursive infra/terraform/modules/ecs-service` exits 0.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/ecs-service
git commit -m "feat(infra): ecs-service reads SSM params, accepts inline task policy"
```

---

### Task 2: `modules/app-secrets` — empty secret shells and SSM config

**Files:**

- Create: `infra/terraform/modules/app-secrets/{main,variables,outputs,versions}.tf` (`versions.tf` identical to `modules/encryption-key/versions.tf`)
- Create: `infra/terraform/modules/app-secrets/tests/app-secrets.tftest.hcl`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `variable "name_prefix"` string, e.g. `"/infinite-ai/staging"`; validation: starts with `/`, does not end with `/`.
  - `variable "secret_names"` `set(string)`, default `[]`; each must match `^[A-Z][A-Z0-9_]*$`.
  - `variable "ssm_config"` `map(string)`, default `{}`; keys match the same pattern **and** must not match `(?i)(SECRET|PASSWORD|TOKEN|API_?KEY|PRIVATE)`.
  - `variable "recovery_window_in_days"` number, default 30; validation: `0` or `7..30`.
  - `variable "tags"` `map(string)`, default `{}`.
  - `output "secret_arns"` `map(string)` (name → `aws_secretsmanager_secret.this[name].arn`).
  - `output "ssm_parameter_arns"` `map(string)` (name → `aws_ssm_parameter.config[name].arn`).
  - Resources: `aws_secretsmanager_secret.this` (`for_each = var.secret_names`, name `"${var.name_prefix}/${each.key}"`, no `kms_key_id`, no version resource) and `aws_ssm_parameter.config` (`for_each = var.ssm_config`, name `"${var.name_prefix}/config/${each.key}"`, `type = "String"`).

- [ ] **Step 1: Write the failing test** `app-secrets.tftest.hcl` (`mock_provider "aws" {}`, `command = plan`):
  - `creates_named_shells`: `secret_names = ["ANTHROPIC_API_KEYS","NEXTAUTH_SECRET"]`; assert two secrets, names exactly `/infinite-ai/staging/ANTHROPIC_API_KEYS` and `/infinite-ai/staging/NEXTAUTH_SECRET`, and `length(keys(output.secret_arns)) == 2`.
  - `creates_config_parameter`: `ssm_config = { AUTH_KEYCLOAK_ID = "infinite-ai-web" }`; assert name `/infinite-ai/staging/config/AUTH_KEYCLOAK_ID`, type `String`.
  - `empty_inputs_create_nothing`.
  - `rejects_lowercase_secret_name` (`"anthropic-keys"`), `rejects_credential_shaped_config_key` (`AUTH_KEYCLOAK_SECRET`), `rejects_prefix_without_leading_slash`, `rejects_recovery_window_of_3`: each `expect_failures` on the matching variable.

- [ ] **Step 2: Run to verify it fails.** `terraform -chdir=infra/terraform/modules/app-secrets test`. Expected: FAIL (module empty).

- [ ] **Step 3: Implement** per the Interfaces block. Header comment mirrors `modules/encryption-key/main.tf`: why empty, the `put-secret-value` command shape, why the managed key, and "tasks fail to start with `ResourceInitializationError` until each secret has a value".

- [ ] **Step 4: Run tests.** Expected: all PASS; `terraform fmt -check` clean.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/app-secrets
git commit -m "feat(infra): app-secrets module for empty secret shells and SSM config"
```

---

### Task 3: `modules/budget` — monthly cost budget with alerts

**Files:**

- Create: `infra/terraform/modules/budget/{main,variables,outputs,versions}.tf`
- Create: `infra/terraform/modules/budget/tests/budget.tftest.hcl`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `variable "name"` string.
  - `variable "monthly_budget_usd"` number, **no default**; validation `> 0`.
  - `variable "alert_emails"` `list(string)`; validation: length ≥ 1 and each contains `@`.
  - `variable "tags"` `map(string)`, default `{}`.
  - `output "budget_name"` and `output "budget_arn"`.
  - One `aws_budgets_budget.this`: `budget_type = "COST"`, `time_unit = "MONTHLY"`, `limit_unit = "USD"`, `limit_amount = tostring(var.monthly_budget_usd)`; four notifications to `alert_emails`: ACTUAL at 50, 80, 100 and FORECASTED at 100, all `PERCENTAGE` and `GREATER_THAN`.

- [ ] **Step 1: Write the failing test.** `mock_provider "aws" {}`, `command = plan`:
  - `four_notifications`: `monthly_budget_usd = 400`, one email; assert `length(aws_budgets_budget.this.notification) == 4`, `limit_amount == "400"`, and exactly one notification has `notification_type == "FORECASTED"`.
  - `rejects_zero_limit`, `rejects_no_recipients` (`[]`), `rejects_malformed_email` (`"ops"`): `expect_failures` on the matching variable.

- [ ] **Step 2: Run to verify it fails.** `terraform -chdir=infra/terraform/modules/budget test`. Expected: FAIL.

- [ ] **Step 3: Implement** with a `dynamic "notification"` over a local list of `{type, threshold}`. Header comment: Budgets is a billing-plane service; the apply role needs `budgets:*` (PowerUser has it) and, for non-root principals, the account's "IAM access to Billing information" setting may need activating (runbook covers this).

- [ ] **Step 4: Run tests.** Expected: PASS; fmt clean.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/budget
git commit -m "feat(infra): budget module with actual and forecast alerts"
```

---

### Task 4: `modules/stack` and environment mains — wiring and outputs

**Files:**

- Modify: `infra/terraform/modules/stack/variables.tf` (add variables below)
- Modify: `infra/terraform/modules/stack/main.tf` (new `app_secrets` and `budget` modules after `encryption_key` at line 286; `secrets` maps of gateway at ~367 and web at ~463)
- Modify: `infra/terraform/modules/stack/outputs.tf`
- Modify: `infra/terraform/environments/{dev,staging,production}/main.tf` and `variables.tf`

**Interfaces:**

- Consumes: `module.app_secrets.secret_arns`, `.ssm_parameter_arns` (Task 2); `module.budget.budget_name` (Task 3); `module.ecs_service_*.execution_role_arn` / `.task_role_arn` (Task 1; `task_role_arn` already exists).
- Produces (stack variables, all with the stated defaults so `dev` and any other caller keep working):
  - `environment` string, **required** (`dev` | `staging` | `production`; validation `contains`). Used only for `name_prefix = "/infinite-ai/${var.environment}"`.
  - `monthly_budget_usd` number, default `null` (null → no budget).
  - `budget_alert_emails` `list(string)`, default `[]`. Recipients passed to the module are `distinct(concat(compact([var.alert_email]), var.budget_alert_emails))`.
  - `keycloak_client_id` string, default `null` (null → no `AUTH_KEYCLOAK_ID` parameter and no web mapping).
  - `recovery_window_in_days` is **not** exposed; stack passes `var.environment == "production" ? 30 : 7`.
- Produces (stack outputs): `app_secret_arns` (map), `app_config_parameter_arns` (map), `gateway_execution_role_arn`, `gateway_task_role_arn`, `worker_execution_role_arn`, `worker_task_role_arn`, `web_execution_role_arn`, `web_task_role_arn`, `budget_name` (null when no budget).

- [ ] **Step 1: Add the failing check.** A `terraform test` for the stack is not feasible (it composes ~12 modules and two providers), so the proof for this task is `terraform validate` on `environments/production` plus the grep assertions below. Run them first and expect them to fail:
      `grep -q 'ANTHROPIC_API_KEYS' infra/terraform/modules/stack/main.tf` and `grep -q 'NEXTAUTH_SECRET' infra/terraform/modules/stack/main.tf` (both exit 1 now).

- [ ] **Step 2: Implement** the variables, the two module blocks (`app_secrets` with `secret_names = ["ANTHROPIC_API_KEYS","NEXTAUTH_SECRET","AUTH_KEYCLOAK_SECRET"]`, `ssm_config = var.keycloak_client_id == null ? {} : { AUTH_KEYCLOAK_ID = var.keycloak_client_id }`; `budget` with `count = var.monthly_budget_usd == null ? 0 : 1`), and the mappings:
  - gateway `secrets` gains `ANTHROPIC_API_KEYS = module.app_secrets.secret_arns["ANTHROPIC_API_KEYS"]`.
  - web `secrets` gains `NEXTAUTH_SECRET` and `AUTH_KEYCLOAK_SECRET` from `secret_arns`, plus `AUTH_KEYCLOAK_ID` from `ssm_parameter_arns` via `merge(...)` only when `var.keycloak_client_id != null`.
  - worker unchanged (verified it never reads provider keys). Add a one-line comment saying so and why.
  - Update the comment above `module "encryption_key"` to cross-reference `app_secrets`.

- [ ] **Step 3: Thread the new inputs** through each environment: all three pass `environment`; `staging` and `production` also pass `monthly_budget_usd`, `budget_alert_emails`, `keycloak_client_id`, each declared in that environment's `variables.tf` with default `null` / `[]` and a description saying "non-secret; set in `<env>.tfvars`". `dev` passes only `environment = "dev"`. Do **not** add `alert_email`, `domain_name` or image-tag values to any tfvars (CI supplies them through `TF_VAR_*`).

- [ ] **Step 4: Verify.** The greps from Step 1 now exit 0. `terraform fmt -check -recursive infra/terraform` exits 0. `terraform -chdir=infra/terraform/environments/production init -backend=false && terraform -chdir=infra/terraform/environments/production validate` prints "Success!" (CI Lint is the verifier if no binary). Also run `grep -rn '"\*"' infra/terraform/modules/ecs-service infra/terraform/modules/app-secrets infra/terraform/modules/budget` and confirm the only hits are in validation conditions.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/modules/stack infra/terraform/environments
git commit -m "feat(infra): wire app secrets, SSM config and budget into stack"
```

---

### Task 5: tfvars files and CI wiring

**Files:**

- Create: `infra/terraform/environments/staging/staging.tfvars`
- Create: `infra/terraform/environments/production/production.tfvars`
- Modify: `.github/workflows/terraform.yml` (Lint job; Plan job's `terraform plan`; Apply job's `terraform apply`)

**Interfaces:**

- Consumes: the three environment variables from Task 4.
- Produces: tfvars content (non-secret only): `monthly_budget_usd`, `budget_alert_emails`, `keycloak_client_id`. Values are **proposed, to be confirmed**: read the monthly infrastructure total in `docs/aws-cost-estimate.html` (ZAR, rate R18.50/USD), convert to USD, add ~20% headroom, round up to a clean number, and write the arithmetic in a comment above the value. `budget_alert_emails` and `keycloak_client_id` are left as `[]` / unset with a `# set before apply` comment if unknown. Do not invent an email address or client id.

- [ ] **Step 1: Write the failing guard.** Add to the Lint job a step "No secrets in tfvars" that fails if any `infra/terraform/**/*.tfvars` matches `(?i)(secret|password|token|api_?key|private_key|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9])` on a non-comment line. Locally run the same `grep -rEn` against the new files before committing them; with a deliberately bad throwaway line in a temp file under the scratchpad it must exit non-zero (prove the guard bites), and with the real files it must find nothing.

- [ ] **Step 2: Create the tfvars files** with the proposed values and explanatory comments.

- [ ] **Step 3: Update `terraform.yml`:** add `-var-file=production.tfvars` to the Plan job's `terraform ... plan` and the Apply job's `terraform ... apply` (paths relative to `-chdir`). Add a Lint step per module that has tests: `terraform -chdir=infra/terraform/modules/<m> init -backend=false && terraform -chdir=infra/terraform/modules/<m> test` for `ecs-service`, `app-secrets`, `budget`. Update the header comment's variable-convention list to say tfvars carry non-secret config and `TF_VAR_*` wins only for values tfvars does not set. Then `grep -n "terraform" .github/workflows/cd.yml scripts/cd/*.sh` and, if any step applies or plans an environment, add the same `-var-file`; if none does, say so in the commit body.

- [ ] **Step 4: Verify.** Prettier is not applicable to `.tfvars`. Run `node_modules/.bin/prettier --check .github/workflows/terraform.yml`. Confirm the workflow parses: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/terraform.yml'))"` exits 0. Expected on the draft PR: Lint job (fmt, validate, three module test runs, tfvars guard) green.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/environments/staging/staging.tfvars infra/terraform/environments/production/production.tfvars .github/workflows/terraform.yml
git commit -m "ci(infra): load per-environment tfvars; run module tests and tfvars secret guard"
```

---

### Task 6: Runbooks, README and open questions

**Files:**

- Create: `docs/RUNBOOKS/aws-setup.md`
- Create: `docs/RUNBOOKS/secrets-rotation.md`
- Modify: `docs/RUNBOOKS/README.md` (index entries)
- Modify: `infra/terraform/README.md` (layout table: add `app-secrets`, `budget`; "Applying this for real": mention `-var-file`, populate-secrets step between steps 2 and 3)
- Modify: `docs/OPEN_QUESTIONS.md` (new entries, next free `OQ-` numbers)

**Interfaces:**

- Consumes: every name from Tasks 1-5 (secret names, output names, tfvars file names, ECS log group `/ecs/<name>`).
- Produces: documents only.

- [ ] **Step 1: Write `aws-setup.md`** with these numbered sections, each with copy-pasteable commands and the expected output:
  1. Install the AWS CLI v2 (link to AWS's install page; `aws --version` expects `aws-cli/2.`).
  2. Credentials and region: `aws configure --profile infinite-ai` with default region `af-south-1`; note that if the account uses the new AWS experience, confirm the Region in AWS Settings and use the credential method AWS Settings provides.
  3. `aws sts get-caller-identity --profile infinite-ai` — expected JSON with the account id.
  4. Region and service availability, **not assumed**: `aws account get-region-opt-status --region-name af-south-1` (expect `ENABLED` or `ENABLED_BY_DEFAULT`) and `aws ssm get-parameters-by-path --path /aws/service/global-infrastructure/regions/af-south-1/services --recursive --query "Parameters[?contains(Name,'secretsmanager') || contains(Name,'/ecs') || contains(Name,'/ssm') || contains(Name,'budgets')].Name" --region af-south-1`. State plainly that the authoring session could not run this.
  5. State backend: point to `infra/terraform/README.md` step 1 (bootstrap already creates the S3 bucket and DynamoDB lock table); do not duplicate. Say state holds generated passwords from existing modules and must be treated as sensitive.
  6. Budget: set by Terraform from `monthly_budget_usd`; also set a spend limit in AWS Settings → Billing if the account has one; note the "IAM access to Billing information" prerequisite if the apply is refused with an access error on `budgets:*`.
  7. Plan and apply for staging: `terraform init -backend-config=backend.hcl`, `terraform plan -var-file=staging.tfvars -var langfuse_init_user_email=...`, apply.
  8. Populate secrets (never via Terraform): for each of `ANTHROPIC_API_KEYS`, `NEXTAUTH_SECRET`, `AUTH_KEYCLOAK_SECRET`, `DB_ENCRYPTION_KEY` a `put-secret-value` command that reads the value from a silent prompt (`read -rs`) or `openssl rand -base64 32`, never an inline literal; `AUTH_KEYCLOAK_SECRET` must equal the Keycloak web client's secret. Then `aws ecs update-service --force-new-deployment` per service.
  9. Prove injection: `aws ecs describe-task-definition --task-definition <name> --query 'taskDefinition.containerDefinitions[0].[environment[].name, secrets[].[name,valueFrom]]'` (secret names appear only under `secrets`, values never appear); `aws ecs describe-tasks` shows `lastStatus RUNNING` and no `ResourceInitializationError` in `stoppedReason`; `aws logs tail /ecs/<name> --since 15m` has no startup errors; `/health` returns 200 through the ALB. Include the Checkov command (`checkov -d infra/terraform --framework terraform`) as something to run locally, marked unrun here.
  10. Failure table: `ResourceInitializationError` (secret has no value yet, or execution role lacks the ARN), `AccessDeniedException` on `GetSecretValue`/`GetParameters` (ARN mismatch), budget creation refused.

- [ ] **Step 2: Write `secrets-rotation.md`:** the stated position (static, manual, 90-day cadence, revisit at the second school or production go-live), and per-secret steps: `ANTHROPIC_API_KEYS` (comma-separated pool: add new key, redeploy gateway, confirm traffic, remove old), `NEXTAUTH_SECRET` (signs everyone out; schedule it), `AUTH_KEYCLOAK_SECRET` (rotate in Keycloak first, then here, then redeploy web), `DB_ENCRYPTION_KEY` (**not** a swap: re-encryption project tied to `DB_ENCRYPTION_KEY_VERSION`; link `docs/POPIA.md`; never automate), database and cache secrets (existing modules; manual re-apply path described in `modules/langfuse/main.tf` comments). Each step names the redeploy command and the check.

- [ ] **Step 3: Update the index and README,** then add three open questions: (a) confirm the proposed monthly budget figures and recipients in the tfvars; (b) existing modules store generated passwords in Terraform state; decide whether to migrate to empty shells or RDS-managed rotation; (c) whether to move Secrets Manager from the AWS-managed key to a customer-managed KMS key, and whether the account needs "IAM access to Billing information" enabled for the budget to be created.

- [ ] **Step 4: Verify.** `node_modules/.bin/prettier --check docs/RUNBOOKS/aws-setup.md docs/RUNBOOKS/secrets-rotation.md docs/RUNBOOKS/README.md infra/terraform/README.md docs/OPEN_QUESTIONS.md docs/superpowers/plans/2026-11-15-secrets-iam-budget.md` passes (run `--write` first if not). `grep -rnE "AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{10}" docs/RUNBOOKS` finds nothing. Every output name used in the runbooks exists in `modules/stack/outputs.tf` (`grep` each).

- [ ] **Step 5: Commit**

```bash
git add docs/RUNBOOKS docs/OPEN_QUESTIONS.md infra/terraform/README.md docs/superpowers/plans
git commit -m "docs(infra): AWS setup and secrets rotation runbooks, README and open questions"
```

---

## Final verification (after Task 6)

- [ ] `git push`, then read the draft PR's checks. Required green: Lint (fmt, validate, module tests, tfvars guard), `forbidden patterns`, `install → lint → typecheck → unit → build`, `RLS isolation suite`. A red Terraform job is fixed forward, never skipped.
- [ ] Update the PR body (stage/task, what changed, how tested, guardrails touched: rule 7 and rule 3) and keep it a draft.
- [ ] Final report states plainly: nothing applied; `terraform`, Checkov and the AWS availability check were not runnable here (or were, per Task 1 Step 0); what CI proved.

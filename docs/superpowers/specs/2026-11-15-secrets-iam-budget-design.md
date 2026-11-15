# Secrets, task IAM and budget for the ECS Fargate stack — design

Status: **awaiting approval**. Nothing in this document has been built.
Date: 2026-11-15. Branch: `ccr-0cf0022f-qn3hsh`.

## Intent

Get every runtime secret the three deployables need into AWS, injected into Fargate
tasks by ECS's native `secrets`/`valueFrom` mechanism (never baked into an image, never a
plain env var), with pilot-appropriate IAM, a stated rotation position, usable outputs
for CI/CD, and a cost alert before the first bill. The shape must carry from one pilot
school to production without a rewrite: per-environment values change, modules do not.

## What already exists (do not rebuild)

Under `infra/terraform/`: `bootstrap/` (S3 state bucket, DynamoDB lock table, GitHub OIDC
deploy and plan roles), `modules/ecs-service` (ECR, task definition, native `secrets`,
execution role scoped to the exact secret ARNs, separate task role), `modules/database`,
`cache`, `encryption-key` (the model for an "empty shell" secret), `object-store`, `ses`,
`sns-escalation`, `langfuse`, `stack` (composes everything), and
`environments/{dev,staging,production,test}`. All target `af-south-1`. Written, never
applied (see `infra/terraform/README.md`).

## Gaps this work closes

1. **Gateway has no provider credentials.** `modules/stack` injects only `DATABASE_URL`
   and `OTEL_EXPORTER_OTLP_HEADERS` into the gateway; `ANTHROPIC_API_KEYS` is not wired.
2. **Web is missing its auth secrets.** `NEXTAUTH_SECRET`, `AUTH_KEYCLOAK_ID` and
   `AUTH_KEYCLOAK_SECRET` (all required by `infra/docker/compose.apps.yml`) are not in the
   web task definition. Identity stays **Keycloak**; there is no Auth0 or Cognito work.
3. **No cost alert.** No `aws_budgets_budget` anywhere.
4. **Task role is managed-policy-ARN only.** `ecs-service` cannot take a small inline
   statement list, so tightening or extending a task role means writing a new managed
   policy module.
5. **No per-environment values file.** Environments take `-var` flags only.
6. **No rotation position is written down.**
7. **ECS `secrets` only understands Secrets Manager in the execution-role policy.** SSM
   parameters can be injected by ECS but the policy builder would not grant them.

## Goals

- New secrets exist as empty Secrets Manager shells; values are set out-of-band with
  `put-secret-value`, so no secret value is ever in a `.tf` file or in state.
- Non-secret per-environment config (e.g. Keycloak client id) lives in SSM Parameter
  Store and is injected the same native way.
- Execution roles can read exactly the ARNs a service names, for both services.
- Task roles are scoped by named ARNs, not wildcards, with one obvious place to tighten.
- One `<env>.tfvars` per environment; modules are environment-agnostic.
- An AWS Budget with email alerts exists for every environment before the pilot.
- Outputs a pipeline or downstream module needs: secret ARNs, SSM parameter ARNs, both
  role ARNs per service, budget name.
- Written, runnable walkthroughs: CLI install, `aws configure` for `af-south-1`,
  `sts get-caller-identity`, service-availability check, backend, budget, apply, and how to
  prove injection in a running task.

## Non-goals

- Applying anything to AWS (no credentials or `terraform` binary in the authoring sandbox).
- Auth0, Cognito, or any identity change.
- Lambda-based automatic rotation (see Rotation).
- A customer-managed KMS key for Secrets Manager (see Calls).
- Changing `bootstrap/`, or how existing modules generate passwords.
- Per-school secrets. Tenancy is enforced in the database (RLS); the platform holds
  per-environment credentials, not per-tenant ones.

## Anti-goals (a failure even if it "works")

- A second, parallel stack or a renamed copy of `ecs-service`.
- Any wildcard action or resource in an IAM statement.
- A secret value, or anything shaped like one, in a `.tf`, `.tfvars`, fixture or doc.
- Disabling TLS or opening an endpoint to make a check pass.
- Presenting unrun Terraform as verified.

## Approaches considered

- **A. Extend in place (chosen).** Two new modules (`app-secrets`, `budget`), additive
  changes to `ecs-service`, wiring in `stack`, tfvars per environment. Smallest diff, one
  way of doing things, `bootstrap/` untouched.
- **B. Literal `modules/{secrets,iam,ecs}` + `envs/` tree beside the existing one.**
  Matches the original sketch but duplicates `ecs-service` and `environments/`, leaving
  two stacks and a later migration.
- **C. Hybrid with a standalone `iam` module.** Cleaner in principle; rewrites unapplied
  code for no pilot benefit.

Chosen by the user: **A**.

## Design

### Module map

| Requested                   | Built as                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `modules/secrets`           | new `modules/app-secrets`                                                                              |
| `modules/iam`               | additions inside `modules/ecs-service`                                                                 |
| `modules/ecs`               | existing `modules/ecs-service`, wired by `modules/stack`                                               |
| `envs/staging`, `envs/prod` | existing `environments/staging`, `environments/production` plus `staging.tfvars` / `production.tfvars` |
| budget                      | new `modules/budget`                                                                                   |

### `modules/app-secrets`

Mirrors `modules/encryption-key`: `aws_secretsmanager_secret` only, no
`aws_secretsmanager_secret_version`. Inputs: `name_prefix` (becomes
`/infinite-ai/<env>`), `secret_names` (set of strings; pilot default
`ANTHROPIC_API_KEYS`, `NEXTAUTH_SECRET`, `AUTH_KEYCLOAK_SECRET`), `ssm_config` (map of
name to plain string, e.g. `AUTH_KEYCLOAK_ID`), `recovery_window_in_days`, `tags`. Outputs:
map of secret name to ARN, map of config name to SSM parameter ARN. Secret names follow
`/infinite-ai/<env>/<NAME>`; parameters follow `/infinite-ai/<env>/config/<NAME>` (type
`String`, never `SecureString` for values that are not secret).

### `modules/ecs-service` additions (all backwards compatible)

- Split `var.secrets` by ARN service: `arn:aws:secretsmanager:` entries get
  `secretsmanager:GetSecretValue`; `arn:aws:ssm:` entries get `ssm:GetParameters`. Each
  statement lists exact ARNs. Existing callers must produce an identical plan.
- New `task_policy_statements` (list of `{sid, actions, resources}`, default `[]`)
  rendered as one inline task-role policy. Validation rejects `"*"` in `actions` or
  `resources`. This is the "tighten later" lever.
- New output `execution_role_arn` (only `task_role_arn` exists today).

### `modules/budget`

`aws_budgets_budget`, cost type, monthly, `limit_amount` from a **required** variable
(no default; each environment's tfvars states it). Notifications at 50% actual, 80%
actual, 100% actual and 100% forecasted, to `alert_emails`. Outputs: budget name.
The threshold figure comes from `docs/COST_MODEL.md`, not from a guess (open item below).

### Wiring (`modules/stack`)

Instantiate `app-secrets` and `budget`. Gateway gains `ANTHROPIC_API_KEYS`. Web gains
`NEXTAUTH_SECRET` and `AUTH_KEYCLOAK_SECRET` (Secrets Manager) and `AUTH_KEYCLOAK_ID`
(SSM). Stack outputs expose every ARN above. Worker gets provider keys only if a grep of
`apps/worker` shows it reads them (CLAUDE.md rule 3: provider credentials belong on the
gateway); default is gateway-only.

### Per-environment values

`environments/staging/staging.tfvars` and `environments/production/production.tfvars`,
applied with `-var-file`. Non-secret only: budget amount and emails, Keycloak issuer and
client id, domain, sizing. Secret values are never in a tfvars file.

### Rotation (stated position)

Static secrets with manual rotation for the pilot; automatic Lambda rotation is deferred
until the second school or production go-live, whichever is first. Reasons: one school,
one operator; provider keys are already a comma-separated pool, so rotation is
add-new-then-remove-old with no downtime; `DB_ENCRYPTION_KEY` rotation is a
re-encryption project, not a secret swap, and must never be automated casually;
`NEXTAUTH_SECRET` rotation signs everyone out. A runbook
(`docs/RUNBOOKS/secrets-rotation.md`) gives per-secret steps, a 90-day cadence, and the
trigger for revisiting.

### Known leak surface to flag (not changed here)

Existing modules (`cache`, `langfuse`, `clickhouse`, `database` app roles) create
`aws_secretsmanager_secret_version` resources from generated values, so those values sit
in Terraform state. The state bucket is encrypted and private, which is acceptable for a
pilot, but state must be treated as sensitive and access to it as access to those
secrets. The walkthrough says so. Migrating them to empty-shell or RDS-managed rotation
is a follow-up, listed in `docs/OPEN_QUESTIONS.md`.

## Calls made (the user can reverse any)

1. Secrets Manager for credentials and keys; SSM Parameter Store standard tier for plain
   config. Secrets Manager costs per secret per month and per 10k API calls; SSM
   standard parameters are free. Nine or so secrets is a few dollars a month per
   environment.
2. Secret names use the requested `/infinite-ai/<env>/<NAME>` convention. This differs
   from the repo's existing `infinite-ai-<env>-...` hyphen style; bootstrap's plan role
   reads only `infinite-ai-*` names, which is fine because it never reads these empty
   shells' values.
3. AWS-managed key (`aws/secretsmanager`), consistent with `encryption-key`'s recorded
   reasoning. Revisit with a CMK if cross-account access or custom rotation is needed.
4. Keep the repo's `production` directory name; tfvars named `production.tfvars`.
5. `terraform` binary and `aws` CLI are absent here: verification is `terraform fmt` and
   `validate` if the binary can be obtained, otherwise stated plainly as unverified.
   Checkov and the AWS MCP servers named in the request are not available in this
   session; the runbook includes the commands to run them.
6. `af-south-1` is an opt-in AWS region and service availability cannot be confirmed
   from this sandbox. The runbook verifies it with the public SSM
   `/aws/service/global-infrastructure/regions/af-south-1/services` listing rather than
   assuming it.

## Open items needing the user

- **Monthly budget figure** per environment. Proposed: derive from `docs/COST_MODEL.md`
  and `docs/aws-cost-estimate.html` plus ~20% headroom, then confirm.
- **Alert email recipients** (staging may reuse `alert_email`).

## Delivery

One branch, commits split by logical change (module `ecs-service` change; `app-secrets`;
`budget`; stack wiring + tfvars; runbooks + README + `STAGE_LOG`/`OPEN_QUESTIONS`
entries). Draft PR. CLAUDE.md's ~400-line PR guideline may be exceeded by runbooks; they
are prose and will be called out in the PR body.

## Left to the builder

Exact variable names and validation messages; resource tags; whether `recovery_window`
differs by environment (suggest 7 days staging, 30 production); runbook wording;
checking `modules/database` and `modules/cache` outputs so injected ARNs and JSON keys
match what the apps read.

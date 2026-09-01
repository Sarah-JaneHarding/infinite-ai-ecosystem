# Terraform

Production infrastructure, region `af-south-1` — data residency is a POPIA requirement,
not a preference (§1.3).

**Status:** written, not applied. Nothing in this directory has ever run against a real
AWS account — this sandbox's own egress policy blocks `registry.terraform.io`, the same
class of restriction documented elsewhere in this repo for `quay.io` and Docker Hub, so
`terraform init`/`plan`/`apply` have never been exercised here. `terraform fmt -recursive
-check` passes across the whole tree (real syntax verification); the resource arguments
themselves are written against the AWS provider's documented schema but have not been
validated by the provider itself. Treat this as a real, reviewed starting point for a
human with AWS credentials to actually run — not as infrastructure that has been proven.

The CD pipeline this directory's own README used to name as its next Tier 1 item
(`.github/workflows/cd.yml`, `scripts/cd/`) is in the same state: written and reviewed,
never run — it deploys to the environments this Terraform provisions, so it cannot be
exercised for real until that Terraform has been `apply`'d at least once by a human with
real AWS credentials, and until step 5 below's GitHub configuration is done.

## Orchestrator: ECS Fargate, not Kubernetes

`docs/RUNBOOKS/canary-deploy.md` used to describe a `kubectl`-based canary procedure
against `infra/k8s/` manifests that never existed. Neither ECS nor Kubernetes was ever
actually decided — this Terraform targets **ECS Fargate**: simpler to operate for three
small services, no cluster control plane or node groups to manage, and AWS-native (no
second orchestrator's worth of IAM, networking, and upgrade surface for what is
currently three deployables). `canary-deploy.md` has been rewritten to match — ECS's own
weighted target groups instead of `kubectl`.

## Layout

```
terraform/
  bootstrap/       remote state bucket, lock table, GitHub Actions OIDC role — applied
                   once, manually, by a human with real AWS credentials, before anything
                   else here can run (see its own README below)
  modules/
    network        VPC, public/private subnets, NAT, S3 gateway endpoint
    database       RDS Postgres 16 + pgvector, Secrets-Manager-backed app roles
    cache          ElastiCache Redis, TLS + AUTH token
    object-store   S3 bucket for Brain snapshots (OBJECT_STORE_BUCKET)
    ecs-service    one reusable Fargate service definition — ECR repo, task def,
                   service, autoscaling, optional ALB target group
    observability  CloudWatch alarms (see "What this does not do" below) + an SNS topic
    clickhouse     one self-hosted ClickHouse node, EC2+EBS — the one piece of this
                   tree that is not ECS Fargate or a managed AWS service; see its own
                   README-equivalent (the module's own header comment) for why
    langfuse       self-hosted Langfuse (LLM observability) — its own ALB, ECS services
                   (pulling docker.langfuse.com directly, not this repo's own ECR/CD),
                   and instances of modules/database, modules/cache, modules/object-store
                   and modules/clickhouse dedicated to it, never shared with the app's own
    stack          composes all of the above into one environment; not itself in the
                   planned layout above, but the same wiring dev/staging/production would
                   otherwise each duplicate
  environments/
    dev            single NAT, no Multi-AZ, smallest instance classes, no domain
    staging        same shape as dev, real domain optional — where
                   docs/RUNBOOKS/database-restore.md and region-loss.md's own drills run
                   before production
    production     Multi-AZ database + cache, one NAT per AZ, deletion protection on,
                   >=2 tasks per service, a real domain required
```

## Applying this for real

1. **Bootstrap, once, manually**, with real AWS credentials (this is the one directory
   whose own state should NOT live in the S3 backend it creates — keep it local or in a
   separately-secured location):

   ```bash
   cd bootstrap
   terraform init
   terraform apply \
     -var 'github_repository=Sarah-JaneHarding/infinite-ai-ecosystem' \
     -var 'github_branches=["main"]'
   ```

   Note the `state_bucket_name`, `lock_table_name`, and `github_deploy_role_arn` outputs —
   the first two go into each environment's `backend.hcl` (copy from
   `backend.hcl.example`); the role ARN goes into a future CD workflow's
   `aws-actions/configure-aws-credentials` step.

2. **Per environment**, e.g. dev:

   ```bash
   cd environments/dev
   cp backend.hcl.example backend.hcl   # fill in the real bucket/table names
   terraform init -backend-config=backend.hcl
   terraform plan
   terraform apply
   ```

   The very first `apply` for a new environment creates every ECS service in a state
   that cannot start a task yet — each service's `image_tag` variable defaults to
   `"unreleased"`, a tag that does not exist in the ECR repository this same `apply`
   just created. That is expected for a from-scratch environment, not a bug: build and
   push a real image (`docker build -f apps/gateway/Dockerfile .`, tagged and pushed to
   the `gateway_ecr_repository_url` output), then re-`apply` with a real `-var
gateway_image_tag=<sha>` (and the same for worker/web).

   This same first `apply` also requires `-var langfuse_init_user_email=<a real email>`
   — modules/langfuse's own required variable, no default (see its own doc comment).
   Unlike gateway/worker/web, Langfuse's own `image_tag` defaults to a real, already-
   published version (`4.25.0`, pulled directly from `docker.langfuse.com`, not this
   repo's own ECR) — nothing "unreleased" to push first, since Langfuse is third-party
   software this repo's CD pipeline never builds.

3. **Bootstrap the database roles and extensions**, once per environment, after step 2's
   first `apply`:

   ```bash
   ./modules/database/bootstrap-roles.sh infinite-ai-dev-db
   ```

   See that script's own header for exactly what it does and why it is a script, not a
   Terraform provisioner.

4. **Run migrations** against the real instance the same way `docs/DEV_SETUP.md` already
   documents for local dev — `DATABASE_URL` pointed at the `migrator` role (its secret is
   in Secrets Manager at `<environment>-db/db/migrator`), `pnpm --filter @infinite-ai/db
db:migrate:deploy`.

5. **Configure the CD pipeline** (`.github/workflows/cd.yml`), once per repository, not
   once per environment:

   - Create two GitHub **Environments** in the repository's Settings → Environments:
     `staging` and `production`.
   - On each, set an **Environment variable** named `AWS_DEPLOY_ROLE_ARN` to this
     bootstrap's `github_deploy_role_arn` output (the same role for both today — one AWS
     account; a separate account per environment would mean a separate role and OIDC
     trust policy, not assumed here).
   - On `production` **only**, add a **required reviewers** protection rule. This is the
     entire production approval gate — the workflow itself has no bypass for it, by
     design (see that job's own comment in `cd.yml`).

   Until this is done, every run of `cd.yml` fails at its first `aws-actions/
configure-aws-credentials` step with an empty `role-to-assume` — a clear failure, not a
   silent no-op or a fallback credential.

## What this does not do

- **Apply itself.** Nothing here runs `terraform apply` unattended — see "Standing
  constraints" below. `.github/workflows/cd.yml` (the CD pipeline, step 5 above) only
  ever changes which already-provisioned task definition revision a service points at;
  it never touches Terraform state, and it cannot create or resize anything this
  directory defines.
- **Compute the SLO metrics `canary-deploy.md` and `region-loss.md` name**
  (`gateway.error_rate`, `web_availability_burn_rate`). The `observability` module's
  alarms use the ALB's own native `HTTPCode_Target_5XX_Count`/`TargetResponseTime`
  metrics against those runbooks' own numeric thresholds — a real signal today, not a
  Langfuse-derived burn-rate metric. Langfuse itself is deployed now (`modules/langfuse`
  — self-hosted, per `INFINITEAI_BUILD_MANUAL.md`'s own line), and gateway/worker both
  ship every OTel span to it (`OTEL_EXPORTER_OTLP_ENDPOINT`/`_HEADERS`, wired in
  `modules/stack`); what remains is turning that trace data into the SLO burn-rate
  alarms these runbooks describe, which is a Langfuse-side (or a Grafana pulling from
  it) dashboard/alerting decision, not something this Terraform's `observability`
  module — keyed on the app's own single ALB — covers for a second, separate ALB.
- **Alarm on Langfuse's own services.** `modules/observability` is keyed on one ALB's
  `arn_suffix`; Langfuse has its own, dedicated ALB (`modules/langfuse`'s own header
  explains why). Extending `observability` to a second, independent ALB is a real, scoped
  follow-up, not attempted in this pass.
- **Automate `region-loss.md`'s cross-region failover.** Production is single-region
  (`af-south-1`) with Multi-AZ, not multi-region — a promoted cross-region read replica
  is its own real decision (which region, cost, when) and its own module, not assumed
  here.
- **Narrow the CI deploy role's IAM permissions past `PowerUserAccess` + a scoped
  `infinite-ai-*` IAM-management statement.** See `bootstrap/main.tf`'s own comment on
  why: hand-enumerating every action Terraform's AWS provider needs across RDS,
  ElastiCache, ECS, ALB, Route53, ACM, S3, and IAM is real, separate security work (most
  likely a permissions boundary), not something to guess at here.

## Standing constraints

- No long-lived cloud credentials. CI authenticates via GitHub Actions OIDC
  (`bootstrap/main.tf`).
- All learner data at rest in `af-south-1`.
- Encrypted off-region backup copies only where residency rules allow it.
- State is remote, locked, and versioned. A destructive plan needs explicit approval —
  nothing in CI or CD runs `terraform apply` unattended. `.github/workflows/cd.yml`
  deploys code (a new image, a new task definition revision); every `apply` — creating
  or resizing what that code runs on — is still a human running the commands above.

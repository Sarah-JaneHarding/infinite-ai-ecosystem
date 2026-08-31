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

## What this does not do

- **Deploy code.** Nothing here builds or pushes a Docker image, or updates a running
  service's `image_tag` on every commit — that is a CD pipeline, the next Tier 1 item
  after this one, not built here.
- **Compute the SLO metrics `canary-deploy.md` and `region-loss.md` name**
  (`gateway.error_rate`, `web_availability_burn_rate`). The `observability` module's
  alarms use the ALB's own native `HTTPCode_Target_5XX_Count`/`TargetResponseTime`
  metrics against those runbooks' own numeric thresholds — a real signal today, not the
  Langfuse/OTel-shaped metric those runbooks will eventually read from Stage 15's
  observability stack, which is not deployed anywhere yet (a separate, larger follow-up
  — Langfuse's self-hosted footprint alone is bigger than everything in this directory).
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
  nothing in CI runs `terraform apply` unattended yet (there is no CD workflow); every
  `apply` today is a human running the commands above.

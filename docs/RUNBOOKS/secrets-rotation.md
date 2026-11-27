# Secrets rotation

Owner: the account operator. Cadence: every **90 days**, and immediately on any suspected
exposure (then follow `suspected-breach.md`). Not yet drilled — rehearse in staging first.

## Position

**Static secrets, rotated by hand, for the pilot.** Automatic rotation (a rotation Lambda
per secret) is deferred until the **second school onboards or production goes live,
whichever comes first**. Why, for one school and one operator:

- The provider keys are a comma-separated pool, so rotation is "add the new key, remove the
  old one" with no downtime and no coordination.
- Most of the other secrets cannot be swapped without a coordinated change elsewhere (a
  Keycloak client secret, a user-session signing key, an encryption key). Automation would
  rotate one side and break the other.
- Rotation Lambdas are extra code, IAM and cost to run and monitor, for a risk that a
  quarterly manual rotation covers while there is one operator.

Revisit when either trigger above fires, or if a second person gets write access to secrets.
Candidates then: the database application-role secrets (`<env>-db/db/<role>`) first, using
Secrets Manager's rotation templates.

## How rotation works here

Every secret is injected when a task **starts**. A new value therefore reaches a service
only after a new deployment:

```bash
CLUSTER=infinite-ai-staging          # the environment's name
aws ecs update-service --cluster "$CLUSTER" --service "$CLUSTER-<service>" --force-new-deployment
```

Confirm with `docs/RUNBOOKS/aws-setup.md` step 9 (task `RUNNING`, no `stoppedReason`, logs
clean, `/health` 200). Secrets Manager keeps the previous version as `AWSPREVIOUS`, which is
your rollback: `aws secretsmanager get-secret-value --version-stage AWSPREVIOUS` (then
re-`put-secret-value` it) if the new value turns out to be wrong.

Enter values only through a silent prompt (`read -rs`) or `openssl rand -base64 32`. Never
inline, never in a ticket or chat.

## Per secret

| Secret                                                  | Used by     | Impact of rotating                                                                                                     | Steps                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/infinite-ai/<env>/ANTHROPIC_API_KEYS`                 | gateway     | None if done in order                                                                                                  | 1. Create a new key in the Anthropic console. 2. Put `OLD,NEW`. 3. Redeploy the gateway, confirm calls succeed. 4. Put `NEW` only, redeploy. 5. Revoke the old key.                                                                                                                                                             |
| `/infinite-ai/<env>/NEXTAUTH_SECRET`                    | web         | Signs every user out                                                                                                   | Schedule outside school hours. `put-secret-value` a new `openssl rand -base64 32`, redeploy web. Users sign in again.                                                                                                                                                                                                           |
| `/infinite-ai/<env>/AUTH_KEYCLOAK_SECRET`               | web         | Sign-in fails if the two sides differ                                                                                  | 1. Regenerate the `infinite-ai-web` client secret in Keycloak. 2. Immediately `put-secret-value` the same value. 3. Redeploy web. Do steps 1–3 back to back.                                                                                                                                                                    |
| `/infinite-ai/<env>/KEYCLOAK_PROVISIONER_CLIENT_SECRET` | web         | Provisioning calls fail (visible as `idp_state` FAILED, retryable) while the two sides differ; sign-in is not affected | **Administrator-equivalent credential.** 1. Regenerate the `infinite-ai-provisioner` client secret in Keycloak. 2. Immediately `put-secret-value` the same value. 3. Redeploy web. 4. Retry any invitation left FAILED in the admin UI. Rotate on a schedule, and at once if it may have leaked or a person with access leaves. |
| Database app roles `<env>-db/db/<role>`, Redis auth     | all         | Connections drop until redeploy                                                                                        | Owned by `modules/database` and `modules/cache`, with the values in Terraform state. Rotate the credential in RDS/ElastiCache, then re-`apply`, then redeploy all three services.                                                                                                                                               |
| Langfuse secrets                                        | tracing     | Tracing gaps until redeploy                                                                                            | Derived from the RDS master secret; after rotating that, re-run `terraform apply` (it re-derives them — see `modules/langfuse/main.tf`), then redeploy Langfuse and the app.                                                                                                                                                    |
| `DB_ENCRYPTION_KEY` (`<env>-db-enc`)                    | web, worker | **Data loss if done wrong**                                                                                            | **Do not rotate.** See below.                                                                                                                                                                                                                                                                                                   |

### `DB_ENCRYPTION_KEY` is not a swap

Learner identifiers are encrypted at rest with this key. Replacing the secret makes every
existing value undecryptable. Rotating it is a re-encryption of every record in every tenant
(see `docs/POPIA.md` for the invariants), and **the repository has no written procedure for
that**. Until one exists — tracked in `docs/OPEN_QUESTIONS.md` — never `put-secret-value`
over this secret, and never automate it. If it is suspected exposed, treat that as a
`suspected-breach.md` incident, not a routine rotation.

## After rotating

Record the date, the secret name (never the value) and who rotated it in the operator log,
and set the next reminder for 90 days out.

## Which test would have caught this earlier

`scripts/ci/check-terraform-secrets.sh` keeps secret values out of committed tfvars and out
of `modules/app-secrets`. Nothing yet checks that a rotated value actually works; the
step-9 verification is the check.

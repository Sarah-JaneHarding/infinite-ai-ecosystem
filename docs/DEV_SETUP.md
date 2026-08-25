# Local development setup

This is the sequence a fresh clone needs to get the full stack — Postgres, Redis,
Keycloak, the gateway, the worker, and the web app — running locally. If you only want
to run the test suites (unit or integration), you don't need any of this: see
`README.md`'s "Getting started" and the "Running the automated tests" section near the
bottom of this file instead.

None of this is automated yet (there is no root `dev` script that starts everything
together) — each step below is a real command you run.

## 1. Prerequisites

- Node 22+, pnpm 10+ (see `README.md`).
- Docker, with a running daemon — `docker info` should succeed. If it doesn't, Docker
  Desktop isn't running (Mac/Windows) or the service isn't started (`sudo systemctl
start docker` on Linux).

```bash
pnpm install --frozen-lockfile
```

## 2. Bring up the dev data plane

Copy the Docker Compose env template and fill it in — see the file itself for what
each variable is for and how to generate a password:

```bash
cp infra/docker/.env.example infra/docker/.env
# edit infra/docker/.env — every line needs a value; openssl rand -base64 24 for passwords
```

```bash
docker compose --env-file infra/docker/.env -f infra/docker/compose.dev.yml up -d
```

Wait for all three services to report healthy:

```bash
docker compose -f infra/docker/compose.dev.yml ps
```

Keycloak's realm import can take 20–30 seconds after the container starts — `ps` will
show it as `starting` until then.

**If Keycloak's client secret substitution doesn't take** (the `${KEYCLOAK_WEB_CLIENT_SECRET}`
/`${KEYCLOAK_WORKER_CLIENT_SECRET}` placeholders in `infra/keycloak/realm.json` are
resolved by Keycloak's own environment-variable placeholder mechanism at import time —
this has not been verified against a live container in this build): open
`http://localhost:8180`, sign in as `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD`, go to the
`infinite-ai` realm → Clients → `infinite-ai-web` → Credentials tab, and copy the secret
shown there into `apps/web/.env`'s `AUTH_KEYCLOAK_SECRET` instead of what you put in
`infra/docker/.env`.

## 3. Run migrations

Migrations need the `migrator` role — the only one with DDL privileges (rule 5;
`infra/docker/initdb/02-roles.sh`).

```bash
export DATABASE_URL="postgresql://migrator:<MIGRATOR_PASSWORD>@localhost:5432/<POSTGRES_DB>"
pnpm --filter @infinite-ai/db db:migrate:deploy
```

(Use the same `POSTGRES_DB`/`MIGRATOR_PASSWORD` values you put in `infra/docker/.env`.)

## 4. Set up each app's own `.env`

Three separate `.env` files, at three different scopes — copy each example and fill it in:

```bash
cp .env.example .env                            # root — shared runtime config
cp apps/gateway/.env.example apps/gateway/.env   # provider credentials, gateway-only
cp apps/web/.env.example apps/web/.env           # next-auth + Keycloak, web-only
```

**Root `.env`** — `DATABASE_URL` here is **not** the migrator URL from step 3. Point it
at `app_rw` — least-privilege, RLS-enforced, what the app actually runs as in production:

```bash
DATABASE_URL=postgresql://app_rw:<APP_RW_PASSWORD>@localhost:5432/<POSTGRES_DB>
REDIS_URL=redis://localhost:6379
GATEWAY_BASE_URL=http://localhost:8080
```

Leave `DB_ENCRYPTION_KEY`, `OBJECT_STORE_*` and `OTEL_*` unset for local dev unless
you're specifically testing something that needs them.

**`apps/gateway/.env`** — real provider credentials only if you're testing an agent flow
that actually calls a model. For everything else (pipeline wiring, RLS, most UI flows),
you can leave `ANTHROPIC_API_KEYS`/`OPENAI_API_KEYS` empty — the gateway starts fine
without them, it just has no live provider to route to.

**`apps/web/.env`**:

```bash
NEXTAUTH_SECRET=<openssl rand -base64 32>
AUTH_KEYCLOAK_ID=infinite-ai-web
AUTH_KEYCLOAK_SECRET=<same value as infra/docker/.env's KEYCLOAK_WEB_CLIENT_SECRET>
AUTH_KEYCLOAK_ISSUER=http://localhost:8180/realms/infinite-ai
```

## 5. (Optional) Seed curriculum data

CE-01/CE-02 need real CAPS/ATP data in L0 to produce anything other than
`NEEDS_INPUT` — see `docs/OPEN_QUESTIONS.md`'s OQ-002 for what's actually been ingested
so far. `pnpm curriculum:seed`/`pnpm curriculum:ratify` write into three fixed dev tenant
ids (`10000000-…001/002/003`), so the dev tenants themselves have to exist first —
`pnpm --filter @infinite-ai/db db:seed` creates them (idempotent; safe to run again):

```bash
pnpm --filter @infinite-ai/db db:seed   # creates the three dev tenants, if not already done
pnpm curriculum:seed                    # submits CAPS/ATP source documents to L0
pnpm curriculum:ratify                  # advances them to committed brain_constitution rows
```

## 6. Start the apps

Three separate processes, three terminals. Neither the gateway nor the worker load a
`.env` file automatically (there is no `dotenv` step anywhere in this codebase — only
`apps/web`, via Next.js's own built-in convention, does that for you) — export the root
`.env` into your shell first:

```bash
set -a; source .env; set +a
```

```bash
# terminal 1
pnpm --filter @infinite-ai/gateway start

# terminal 2 (same exported env)
pnpm --filter @infinite-ai/worker start

# terminal 3 — Next.js loads apps/web/.env itself, nothing extra needed
pnpm --filter @infinite-ai/web dev
```

Visit `http://localhost:3000` and sign in via the Keycloak sign-in button. You'll need a
user account and role assignment in the realm to actually reach a role surface — the
imported realm ships no users; create one via the Keycloak admin console
(`http://localhost:8180`) or through the app's own onboarding flow once you're signed in
as an admin.

## Running the automated tests

You don't need any of the above for this — see the root `README.md`'s "Getting started"
for `pnpm test` (unit tier, no Docker), and this excerpt for the integration tier
(real Postgres via Testcontainers, self-contained, no manual setup):

```bash
pnpm --filter @infinite-ai/db test:integration
pnpm --filter @infinite-ai/brain test:integration
pnpm --filter @infinite-ai/orchestrator test:integration
pnpm --filter @infinite-ai/curriculum-seed test:integration
```

Each spins up its own throwaway Postgres, runs migrations against it, and tears it down
— nothing here touches the dev data plane from step 2.

## Troubleshooting

| Symptom                                                          | Cause                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docker compose up` fails with `":?set X in your local .env"`    | A variable in `infra/docker/.env` is missing or empty — check against `infra/docker/.env.example`.                                                           |
| Gateway/worker exits immediately citing `DATABASE_URL: Required` | You didn't `source .env` into the shell before starting it (step 6) — Node processes here don't auto-load `.env`.                                            |
| `prisma migrate deploy` fails with a permissions error           | `DATABASE_URL` is pointed at `app_rw`, not `migrator` — migrations need DDL privileges only `migrator` has.                                                  |
| The app connects but every query 403s / returns nothing          | `DATABASE_URL` is pointed at `migrator` at runtime instead of `app_rw` — swap it back (step 4).                                                              |
| Keycloak sign-in redirects to an error page                      | `AUTH_KEYCLOAK_SECRET` doesn't match the realm's actual client secret — see the fallback note in step 2.                                                     |
| `docker pull ...` fails with 403/Forbidden                       | An egress policy is blocking the registry, not a Docker problem — check your network/proxy configuration before assuming Testcontainers or Docker is broken. |

# The development and testing sandbox

One command from a clean checkout to a running, seeded, disposable platform — and a clean container to
lint, typecheck, test and build it in. It exists so that "does it work on a machine that is not mine?" has
a one-line answer, and so that nothing a test run does can reach the host checkout.

```bash
pnpm sandbox up        # secrets generated on first run; Postgres + Redis + Keycloak; migrate; seed
pnpm sandbox verify    # prove the sandbox honours the platform's isolation invariants
pnpm sandbox check     # lint + typecheck + format:check + unit tests, in a clean container
pnpm sandbox --help    # everything else
```

Needs Docker with a running daemon and Compose 2.24 or later (`pnpm sandbox doctor` checks).

**This is not a replacement for `docs/DEV_SETUP.md`.** That is the long, hand-assembled path, and it stays the
reference for what each piece is. The sandbox is the same data plane (it reuses `infra/docker/compose.dev.yml`
unchanged) with the manual steps — three `.env` files, two Compose projects, migrate, seed, the identity seed —
collapsed into commands.

## What you get

| Piece                  | What it is                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres 16 + pgvector | `127.0.0.1:5432`, the four roles (`migrator`, `app_rw`, `worker_rw`, `analytics_ro`) bootstrapped by the repo's own `infra/docker/initdb` scripts |
| Redis 7                | `127.0.0.1:6379`                                                                                                                                  |
| Keycloak 26            | `http://localhost:8180`, the `infinite-ai` realm imported from `infra/keycloak/realm.json`                                                        |
| The toolbox            | A Node 22 + pnpm container (`infra/sandbox/Dockerfile`): `pnpm sandbox run                                                                        | shell | test | check` |
| Seeded data            | The three synthetic dev tenants and the seven dev identities (`db:seed`, `db:seed:identities`)                                                    |
| Opt-in: observability  | `pnpm sandbox observability` adds MinIO and the Langfuse stack (large)                                                                            |
| Opt-in: the apps       | `pnpm sandbox apps` builds and starts web, worker and gateway (needs model credentials)                                                           |

Everything is synthetic. There is no real learner or school data in a sandbox, by construction (rules 3, 4).

## Safety properties

Each of these is asserted by `packages/security/test/sandbox.spec.ts`, which reads the real files and runs the
real secret generator:

- **No secret is committed (rule 7).** `pnpm sandbox up` writes `infra/sandbox/.env` on first use with fresh
  random values — 32-character URL-safe database passwords (they are embedded in connection strings), passwords
  that satisfy the realm policy, 256-bit keys in the format each consumer needs. The file is mode `600` and git
  ignores it. Two generations share no secret. A new required variable in `infra/docker/.env.example` with no
  generation rule makes the script fail rather than leave it blank. `pnpm sandbox reset` deletes the data but
  keeps the file, so credentials stay valid; delete the file to rotate everything.
- **Not reachable from the network.** Postgres, Redis and Keycloak are published on `127.0.0.1` only.
- **Cannot touch your checkout.** The repository is mounted **read-only**; the toolbox copies it into a volume,
  installs from the lockfile (`--frozen-lockfile`), and runs there. `node_modules`, `.next`, generated Prisma
  clients and anything else a command writes stay in the container. Your `.env` files are not copied in.
- **No Docker socket, no privileged containers, no host namespaces.** The toolbox runs as an unprivileged user
  with a memory and CPU cap.
- **Its own state.** The Compose project is `infinite-ai-sandbox`, so its volumes never mix with a `docker
compose` dev stack you already run.
- **RLS is still the second line (rule 5).** The toolbox's default connection is `app_rw`. Only the one-shot
  `migrate` step uses the schema-owning role, to apply migrations and seeds.

## `pnpm sandbox verify`

A smoke test, not the test suite. It proves the sandbox itself is wired the way production is, and exits with the
number of failed checks:

- the four database roles and the three extensions exist;
- every migration on disk has been applied;
- **row-level security fails closed**: a query as `app_rw` with no tenant context is an error, not an empty
  result (CLAUDE.md invariant 1);
- a tenant context sees exactly its own tenant;
- the dev identities are seeded;
- Keycloak serves the `infinite-ai` realm, and Redis answers `PING`.

It was exercised against a real migrated database with three deliberate breakages — `app_rw` granted `BYPASSRLS`,
a migration record missing, the seeds absent — and failed each time, for the right reason.

## The toolbox

`pnpm sandbox run <command>` runs any command in a clean container; `shell` opens one; `test` and `check` are the
common ones. Each run first copies the repository (`rsync`, deleting what you deleted) and installs from the
lockfile — fast when nothing changed, because `node_modules` and the pnpm store live in volumes.

```bash
pnpm sandbox run pnpm --filter @infinite-ai/db typecheck
pnpm sandbox run pnpm --filter @infinite-ai/policy test rbac
SANDBOX_NO_SYNC=1 pnpm sandbox run pnpm test      # skip the copy: run what is already in the volume
```

**What it does not cover:** the Testcontainers **integration tier** (`pnpm test:integration`) needs a Docker
daemon, and a container that can start containers needs the host's Docker socket — which is root on the host. The
sandbox deliberately does not hand that out. Run the integration tier on the host (`pnpm test:integration`,
needs Docker) or let CI run it. Likewise the Playwright tiers (e2e, accessibility, Lighthouse) need a browser the
toolbox does not contain.

## The apps (optional)

```bash
ANTHROPIC_API_KEYS=sk-... pnpm sandbox apps
```

The gateway **refuses to boot** without model credentials, and the sandbox stores none: pass them in your shell
for that one command (nothing is written to disk). With only an Anthropic key it selects
`routing.anthropic.json`, the routing file that names only Anthropic. Use test credentials with a spend limit.
`LOCAL_MODEL_BASE_URL` points it at an OpenAI-compatible server such as Ollama instead.

Signing in needs Keycloak reachable at **one URL from both your browser and the web container**
(`http://host.docker.internal:8180/realms/infinite-ai`). Docker Desktop resolves that name; on Linux, add
`127.0.0.1 host.docker.internal` to `/etc/hosts`, and start the sandbox with
`SANDBOX_KEYCLOAK_BIND=0.0.0.0 pnpm sandbox up` — a Linux container reaches the host's published port through the
bridge gateway, which a loopback-only port does not serve. That widens Keycloak (dev realm, temporary passwords) to
your network for as long as it runs; do it on a network you trust, or use Docker Desktop.

## Troubleshooting

| Symptom                              | Cause and fix                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `the Docker daemon is not reachable` | Start Docker Desktop, or `sudo systemctl start docker`.                                                   |
| `Compose … is too old`               | The overlay uses `!override` (Compose 2.24+). Upgrade the plugin.                                         |
| `no rule for … variable X`           | Someone added a required variable to `infra/docker/.env.example`; add its rule to `generate_env`.         |
| Keycloak restart-loops               | Its realm import failed — see the comments in `compose.dev.yml`. `pnpm sandbox reset && pnpm sandbox up`. |
| `migrate` fails with `P3005`         | A schema is not empty and has no migration history. `pnpm sandbox reset` starts clean.                    |
| Want to rotate every credential      | `pnpm sandbox reset`, delete `infra/sandbox/.env`, `pnpm sandbox up`.                                     |

## What was verified when this was written, and what was not

The sandbox was authored in an environment with the Docker client and Compose plugin but **no Docker daemon**, so
no container was started. Verified:

- `docker compose config` parses and merges the real files with a generated environment: ports on loopback,
  separate project name, profiles as intended, the migrator and `app_rw` URLs where they should be, and
  `compose.apps.yml` unchanged by default (its network name is now overridable).
- The secret generator, run for real: every variable filled, mode `600`, format and policy constraints met.
- The repo's own `initdb` scripts, `db:migrate:deploy`, `db:seed` and `db:seed:identities` against a real
  PostgreSQL 16 with pgvector, then `sandbox-verify` against it (database checks), including the three
  deliberate breakages.
- Shell syntax of all three scripts. The 35 guard tests.

**Not verified — run `pnpm sandbox up && pnpm sandbox verify` once and report what breaks:** building the toolbox
image; the rsync/install entrypoint; booting Keycloak with the generated realm secrets; the Keycloak and Redis
checks in `verify`; the `apps` profile; the `host.docker.internal` Linux workaround. These follow the patterns
`compose.dev.yml` and `compose.apps.yml` already use, but "follows the pattern" is not "ran".

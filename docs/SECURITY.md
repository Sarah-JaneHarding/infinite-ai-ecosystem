# Security

## 1. Security model in one page

The platform holds children's personal information. The controls below are architectural,
not configurable: there is no environment variable, feature flag or support override that
turns any of them off.

| Control          | Where it lives                                                                                                                                             | Proven by                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tenant isolation | `tenant_id` on every tenant-owned row; Postgres RLS with `FORCE ROW LEVEL SECURITY`; a tenant-scoped client that is the only exported database entry point | Exhaustive RLS suite (Stage 01, re-run on every change)          |
| Authentication   | Keycloak OIDC, short-lived sessions, server-side refresh, MFA for `admin`, `smt`, `platform_*`                                                             | Stage 02 auth suite                                              |
| Authorisation    | A declarative permission matrix — resource × action × role × scope — behind a single `authorize()` call                                                    | Generated authorisation-matrix test over every role × permission |
| Audit            | Append-only, hash-chained ledger written through an INSERT-only database role                                                                              | Hash-chain verification test + tamper-detection job              |
| PII egress       | The De-identification Service plus a mandatory PII guard on the only path to the Model Gateway                                                             | Fuzz + red-team suites; a test asserting no second path exists   |
| Model egress     | One self-hosted gateway; no provider SDK outside `apps/gateway`                                                                                            | ESLint rule + repo-wide test                                     |
| Human gates      | Approval record must exist before a guarded transition commits                                                                                             | Bypass test attempting every known vector                        |
| Secrets          | SOPS + age for config, AWS Secrets Manager in production; nothing in the repository                                                                        | Secret scanning in CI and over git history                       |

## 2. Trust boundaries

Browser → web app → worker → gateway → provider; web/worker → database; connectors →
raw landing zone; tenant → commons. Each boundary gets a STRIDE pass in Stage 16, recorded
in this document with every mitigation mapped to a named test.

## 3. Threat model

Completed in Stage 16. Until then this section is deliberately empty rather than
speculative — an unratified threat model is worse than none, because it invites the belief
that the work has been done.

## 4. The permanent safety suite

Runs on **every** change regardless of what changed (Part 4 §4.3). If any of these fails,
nothing merges, and there is no override:

1. Cross-tenant leakage (exhaustive, table-driven)
2. PII egress attempts through every agent
3. Prompt injection via retrieved documents, user input and uploaded files
4. Diagnosis and clinical-language refusal
5. Safeguarding escalation drill
6. HITL bypass attempts
7. Authorisation matrix
8. Log and trace scrubbing

## 5. Coverage thresholds for safety-critical packages

`packages/policy`, `packages/deident`, `packages/guardrails` and `packages/db` (tenant
client and RLS) hold line coverage ≥ 95%. Mutation testing runs against them before
Stage 16; every surviving mutant is justified in writing.

## 6. Reporting a vulnerability

Until the disclosure address is provisioned (tracked in `OPEN_QUESTIONS.md`), report to
the repository owner directly. Do not open a public issue for a security finding.

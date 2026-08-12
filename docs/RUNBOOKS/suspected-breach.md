# Suspected breach

**RTO:** ≤ 4 hours from detection to containment (access revoked, affected tenants notified).
**RPO:** Not applicable — the audit ledger is append-only and cannot be altered by the attacker.

**Status:** Written in Stage 15. Annual drill required (see `docs/RUNBOOKS/README.md`).

## What the alert means

Any of the following conditions indicates a possible breach and triggers this runbook:

- An `audit_event` pattern shows a principal accessing data outside their declared purpose.
- A guardrail log shows a repeated injection attempt that succeeded (i.e. was not blocked).
- An external report (teacher, school, DBE, SAPS) of unexpected data disclosure.
- A CI secret-scanning alert for a credential committed to the repository.
- Cloud provider notification of unusual access to object storage or the database.

## Who owns it

The POPIA/data-protection contact (incident commander), with the platform engineer (technical response), the CEO (internal escalation), and legal counsel (external notification). A suspected breach involving learner data **must** reach the Information Regulator within 72 hours if a reasonable likelihood of harm exists — POPIA §22.

## The first action

**Isolate, do not delete.** Preserve the evidence; revoking access stops the bleeding without destroying the audit trail.

1. Identify the suspected actor (API key, session token, user ID).
2. Revoke the credential or terminate the session immediately.
3. Do **not** delete any logs, audit events, or database rows — they are evidence.
4. Capture a snapshot of the affected database state before any remediation.

## How to confirm the diagnosis

1. Pull the audit chain for the suspected actor: `pnpm --filter @infinite-ai/telemetry exec tsx scripts/verify-chain.ts --tenant <id>`.
2. Check `audit_event` for `action IN ('read','export','batch_read')` in the window of suspected access.
3. Check gateway logs for unusual token volumes or prompt patterns (injection signatures).
4. Check the CI run history for any commit that introduced or touched secrets.

## The fix

### Credential leak

1. Rotate the affected credential immediately (provider API key, database password, `NEXTAUTH_SECRET`).
2. Audit every request made with the leaked credential in the gateway logs.
3. Assess whether any personal information was exposed.

### Unauthorised data access

1. Disable the actor's account or API key.
2. Review the access pattern to determine which tenants and which data subjects were affected.
3. Notify affected tenants within 24 hours of confirmation.
4. Notify the Information Regulator within 72 hours if the criteria in POPIA §22 are met.

### Prompt injection that escaped guardrails

1. Identify the agent and the injection vector.
2. Roll back the agent's prompt if the injection exploited a recent change (see `bad-prompt-promotion-rollback.md`).
3. Add a new guardrail test case for the injection pattern so it is caught in future: `pnpm --filter @infinite-ai/guardrails test`.

## How to verify recovery

- `pnpm --filter @infinite-ai/telemetry exec tsx scripts/verify-chain.ts --tenant <id>` shows the chain intact.
- The revoked credential no longer authenticates.
- No new `audit_event` rows appear for the actor after revocation.

## What to record afterwards

- Detection time, containment time (actual RTO), notification times.
- Data exposed: tenants, data subjects, data categories.
- Whether the 72-hour Information Regulator notification window was met.
- Root cause and remediation.
- Post-incident review scheduled within 5 business days.
- Entry in `docs/RUNBOOKS/drill-results/` (anonymised).

## Which test would have caught this earlier

`pnpm test:injection` (prompt-injection suite) and `pnpm --filter @infinite-ai/guardrails test` — injection attempts that reach production should have been caught by the guardrail plane. A breach that bypasses both is a signal to add a test case for the specific vector.

# Bad prompt promotion rollback

**RTO:** ≤ 15 minutes from identifying the bad champion to the previous champion serving traffic.
**RPO:** 0 — the rollback is a new promotion record, not a mutation; the bad record stays in the ledger.

**Status:** Written in Stage 15 (mirrors the rollback mechanism in packages/learning/src/promotion-log.ts).

## What the alert means

`guardrail.pii_block.total` or `guardrail.injection_block.total` spikes after a recent prompt promotion, or a teacher or HoD reports unexpected or harmful artefact quality. The most recent champion prompt for a given agent is producing outputs that the guardrail plane is blocking at an elevated rate, or outputs that passed guardrails but are educationally wrong.

## Who owns it

ML safety lead, with the HoD of the affected school notified within 15 minutes. Escalate to the POPIA contact if any blocked output contained learner PII.

## The first action

Identify the agent and module from the guardrail spike. Check the prompt registry (`/admin/prompts`) for the promotion date of the current champion and compare it to the spike onset.

## How to confirm the diagnosis

1. Pull the last 20 blocked outputs for the affected agent from the run inspector.
2. Confirm the guardrail reason (e.g. `pii_guard`, `injection_block`, `output_schema_violation`).
3. Confirm the promotion timestamp predates the spike onset.
4. Run the agent's eval set against the current champion: `pnpm evals:run --all` and `pnpm evals:gate`.

## The fix

**No prompt file is mutated. No Brain row is deleted.** The rollback creates a new promotion record that points at the previous champion version.

1. In the prompt registry UI (`/admin/prompts`), find the affected agent and click "View ratification history".
2. Identify the previous champion version (the one immediately before the current one).
3. Click "Propose rollback to vX.Y.Z" — this creates a challenger record with `isRollback: true`.
4. The HoD or SMT approves the rollback via the normal approval UI (`/approvals`).
5. Once approved, the previous version becomes the new champion and the bad version is archived.

If the approval queue itself is unavailable, the platform admin can apply an emergency rollback via:

```bash
pnpm --filter @infinite-ai/prompts exec tsx scripts/emergency-rollback.ts \
  --agent CE-01 --version 2.1.0 --reason "guardrail-spike-2026-08-12" --actor <platform-admin-id>
```

This still creates an audit record; it does not bypass the append-only ledger.

## How to verify recovery

- `guardrail.pii_block.total` and `guardrail.injection_block.total` return to baseline rate.
- `pnpm evals:gate` exits 0 for the affected agent.
- The prompt registry shows the previous version as the current champion.

## What to record afterwards

- Agent, bad version, rollback version, start time, resolution time (actual RTO).
- Number of artefacts affected (blocked or low-quality).
- Root cause of the bad promotion (e.g. eval set did not cover a new input distribution).
- Whether the rollback approval path worked as designed.
- Entry in `docs/RUNBOOKS/drill-results/`.

## Which test would have caught this earlier

`pnpm --filter @infinite-ai/prompts test` (prompt-lock integrity) and `pnpm evals:gate` — a challenger that would have degraded refusal rates would fail the eval gate before promotion.

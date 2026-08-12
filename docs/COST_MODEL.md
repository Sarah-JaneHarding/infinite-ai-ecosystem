# Cost Model

Per-school, per-artefact, and per-learner cost estimates in ZAR for the INFINITE-AI
platform. All figures are estimates based on Stage 17 tier pricing and typical usage
patterns. Actual costs depend on model pricing, learner counts, and artefact generation
frequency.

**OQ-018 blocks a precise model:** real gateway telemetry from a live school is needed to
calibrate artefact-generation costs. Figures below use conservative estimates.

---

## Subscription tiers

| Tier         | Learner limit      | Price (ex VAT)  | Price (inc 15 % VAT) |
| ------------ | ------------------ | --------------- | -------------------- |
| Starter      | Up to 150 learners | R 1 200 / month | R 1 380 / month      |
| Professional | Up to 500 learners | R 3 500 / month | R 4 025 / month      |
| Enterprise   | Unlimited          | R 8 500 / month | R 9 775 / month      |

---

## Cost per artefact (model gateway)

Artefact generation cost is driven by the model gateway. Claude Sonnet 4 is the default
model for all CE, TB, PD, and LE agents. Estimated token usage per artefact type:

| Artefact type                  | Avg input tokens | Avg output tokens | Est. cost (USD) | Est. cost (ZAR)* |
| ------------------------------ | ---------------- | ----------------- | --------------- | ---------------- |
| Lesson plan (CE-03)            | 2 500            | 1 500             | $ 0.022         | R 0.40           |
| Unit blueprint (CE-02)         | 4 000            | 2 500             | $ 0.037         | R 0.67           |
| Assessment task (CE-04)        | 3 000            | 2 000             | $ 0.029         | R 0.53           |
| Rubric (CE-06)                 | 2 000            | 1 200             | $ 0.018         | R 0.33           |
| Simplified explanation (TB-01) | 1 500            | 800               | $ 0.012         | R 0.22           |
| Practice worksheet (TB-03)     | 2 000            | 1 500             | $ 0.018         | R 0.33           |
| PD micro-course (PD-07)        | 5 000            | 3 000             | $ 0.047         | R 0.85           |

\* Exchange rate: 1 USD = R 18. This will vary.

---

## Cost per learner per month

Estimated model cost per learner per month, assuming typical usage patterns:

| Tier         | Learners | Artefacts / learner / month | Model cost / month |
| ------------ | -------- | --------------------------- | ------------------ |
| Starter      | 150      | 8                           | ~ R 480            |
| Professional | 500      | 8                           | ~ R 1 600          |
| Enterprise   | 1 000    | 8                           | ~ R 3 200          |

**Margin estimate (Starter tier):**

- Revenue: R 1 200
- Estimated model cost: R 480
- Infrastructure (hosting, DB, Redis): ~ R 300
- Gross margin: ~ R 420 / month (35 %)

This is a rough estimate. Infrastructure costs are shared across tenants and depend on
the hosting provider. Real costs will differ once OQ-018 is resolved.

---

## Cost per school per year

| Tier         | Annual subscription (inc VAT) | Estimated model cost | Total cost to school |
| ------------ | ----------------------------- | -------------------- | -------------------- |
| Starter      | R 16 560                      | R 5 760 (our cost)   | R 16 560             |
| Professional | R 48 300                      | R 19 200 (our cost)  | R 48 300             |
| Enterprise   | R 117 300                     | R 38 400 (our cost)  | R 117 300            |

---

## Metering and reconciliation

The billing system reconciles at month-end:

1. `metering_period` accumulates `tenant_metering_event` rows (one per gateway call).
2. At month-end, the reconciliation job (`pnpm test:billing:reconcile`) computes
   `total_cost_cents` from events and compares to the subscription tier ceiling.
3. If actual cost exceeds the tier ceiling, the school is notified and may be offered an
   upgrade.
4. An invoice (`tenant_invoice`) is generated with line items:
   - Base subscription fee.
   - (Future) Overage charges if usage exceeds tier limits.
5. 15 % VAT is applied to all line items.

---

## Budget alerts

Per-agent cost budgets are set in `packages/agents` (`costBudgetCents`). When a single
call would exceed the budget, the gateway refuses the call with `cost_budget_exceeded`.
The orchestrator logs the refusal and the human-in-the-loop gate fires for review.

Recommended alerts:

- Monthly model cost exceeds 60 % of subscription tier price → warning.
- Monthly model cost exceeds 90 % of subscription tier price → page on-call.

---

## Open questions

See OQ-018 in `docs/OPEN_QUESTIONS.md`: real gateway telemetry from a live school is
needed to replace the estimates above with calibrated figures. The cost model should be
re-validated after the first pilot month.

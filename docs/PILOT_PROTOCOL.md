# Pilot Protocol

This document defines the success metrics, weekly review cadence, and escalation path
for the INFINITE-AI pilot programme.

**OQ-019:** Specific pilot schools have not yet been confirmed. This protocol applies
once schools are identified and onboarded via the provisioning wizard.

---

## Pilot cohort

Target: 3 schools in the first pilot cohort.

| School profile                                    | Rationale                                                  |
| ------------------------------------------------- | ---------------------------------------------------------- |
| Small primary (< 150 learners, Starter tier)      | Validates the Starter pricing model and wizard flow.       |
| Large primary (≈ 500 learners, Professional tier) | Validates Professional-tier capacity.                      |
| School group (≥ 2 campuses, Enterprise tier)      | Validates multi-campus provisioning and shared curriculum. |

Each pilot school is assigned an implementation partner contact and an on-call engineer.

---

## Success metrics

### Week 4 (end of onboarding phase)

| Metric                           | Target                         |
| -------------------------------- | ------------------------------ |
| Provisioning wizard completed    | 100 % of pilot schools         |
| Readiness score                  | 100 for all pilot schools      |
| Staff invitation acceptance rate | ≥ 80 % within 5 days of invite |
| Zero POPIA data incidents        | ✓                              |

### Week 8 (first full term of use)

| Metric                                         | Target                      |
| ---------------------------------------------- | --------------------------- |
| Weekly active educators                        | ≥ 60 % of invited educators |
| Artefacts generated per educator per week      | ≥ 3                         |
| Artefact quality rating (educator self-report) | ≥ 3.5 / 5 average           |
| Guardian consent rate (for learner data use)   | ≥ 70 % of learners          |
| First invoice generated and delivered          | ✓                           |
| Zero security incidents                        | ✓                           |

### Week 16 (end of pilot)

| Metric                                        | Target                           |
| --------------------------------------------- | -------------------------------- |
| Pilot schools renewing (or converted to paid) | ≥ 2 of 3                         |
| Monthly active educators                      | ≥ 70 % of invited educators      |
| Net Promoter Score (educator survey)          | ≥ 40                             |
| Model cost within 120 % of estimate           | ✓                                |
| SLO breaches                                  | 0 P1 incidents; ≤ 2 P2 incidents |

---

## Weekly review cadence

### Participants

- Implementation partner lead (school side)
- Platform product owner
- On-call engineer
- (Week 8+) Billing lead

### Agenda (30 minutes)

1. **Usage metrics** (5 min): artefacts generated, active users, any anomalies.
2. **Issues logged** (5 min): any bugs, confusing UI, missing features.
3. **Educator feedback** (10 min): qualitative feedback from the implementation partner.
4. **Technical health** (5 min): SLO status, any incidents since last review.
5. **Next steps** (5 min): actions from this review, owner, due date.

### Artefacts produced per review

- Brief written summary (shared in the implementation partner's Slack/email).
- Any issues logged in `docs/OPEN_QUESTIONS.md` if they require a design decision.
- Bug reports filed as GitHub issues with `pilot` label.

---

## Escalation path

| Situation                            | Action                                           | Owner            | SLA                    |
| ------------------------------------ | ------------------------------------------------ | ---------------- | ---------------------- |
| Educator cannot log in               | Check auth provider, reset session               | On-call engineer | 2 hours                |
| Artefact generation fails repeatedly | Diagnose via gateway logs; check budget          | On-call engineer | 4 hours                |
| PII observed in a log or artefact    | Security incident — see `INCIDENT_PROCESS.md`    | Security lead    | Immediate              |
| POPIA data-subject request received  | Follow POPIA DSR process                         | Operations team  | 30 days (statutory)    |
| School wants to withdraw from pilot  | Discuss with product owner; begin offboarding    | Product owner    | Within 5 business days |
| SLO breach (P1)                      | Page on-call, open incident, notify pilot school | On-call engineer | 15 minutes             |

---

## Pilot offboarding

If a school exits the pilot before completion:

1. Notify the operations team.
2. Set tenant status to SUSPENDED (billing pauses).
3. Export any school-owned data the school requests (data portability — POPIA §18).
4. After 30 days with no objection, mark tenant CLOSED and erase mutable data.
5. Retain audit and consent ledgers as per legal obligation (OQ-022).

---

## Go/no-go decision (end of pilot)

A go/no-go meeting is held at week 16 with the following decision criteria:

| Criterion             | Go                       | No-go                   |
| --------------------- | ------------------------ | ----------------------- |
| Schools renewing      | ≥ 2 of 3                 | 0 of 3                  |
| P1 security incidents | 0                        | Any                     |
| POPIA compliance gaps | None                     | Any unresolved          |
| Model cost at scale   | Within 130 % of estimate | > 200 % (unsustainable) |
| Educator NPS          | ≥ 30                     | < 10                    |

A "no-go" result requires a documented plan to address blockers before re-piloting.
Open questions blocking go-live are logged in `docs/OPEN_QUESTIONS.md`.

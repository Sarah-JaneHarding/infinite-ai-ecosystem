# POPIA

## 1. Roles under the Act

The **school or its governing body is the responsible party** for learner personal
information. **INFINITE-AI is the operator**, processing only on the school's documented
instruction, within the school's tenant, inside `af-south-1`.

That split drives the architecture: the school ratifies its own constitution (L0), owns
its consent ledger, and can export or erase its data without our involvement.

## 2. The privacy invariants

These are enforced by code and proven by tests, not by policy documents:

1. **No learner personal information enters a prompt.** Everything derived from learner
   data passes through the De-identification Service and carries
   `{ deidentified: true, salt_version, dropped: [...] }`. The PII egress guard sits on
   the only path to the Model Gateway and rejects anything without that provenance.
   Rejection is a hard error, never a warning.
2. **Purpose limitation is enforced at query time.** Every query for learner data takes a
   `purpose`. The data layer intersects the requested columns with the purpose's
   allow-list and the subject's consent, and **drops** disallowed columns. Every drop is
   logged.
3. **Minimality.** The smallest field set that answers the question, never the whole
   profile.
4. **Re-identification happens only inside the school boundary**, for an authorised role,
   against a stated purpose, and writes an audit event.
5. **Special personal information** (health, disability, biometrics) sits under stricter
   handling, application-level encryption and shorter retention.
6. **Row-level tenant isolation.** No cross-school inference on identifiable data, ever.

## 3. Purpose taxonomy

Defined in `packages/contracts` in Stage 03. Each purpose declares the data categories it
may touch:

`planning` · `screening` · `intervention` · `reporting_parent` · `reporting_district` ·
`pd_analytics` · `product_improvement`

A purpose that is not on this list does not exist. Adding one requires updating this
document and the consent model **first**, and having that ratified before code is written.

## 4. Consent ledger

Per data subject, per data category, per purpose: lawful basis, source of consent,
timestamp, evidence reference, and withdrawal. Consent is versioned and never deleted.

## 5. Retention and erasure

- Learner personal information carries a TTL from the retention schedule. Policy and
  curriculum do not expire.
- A nightly job tombstones expired PII.
- `subject_erasure` (a) tombstones personal data, (b) **preserves the decision record**
  with the subject replaced by its token, (c) triggers reindexing, (d) emits an audit
  event. The memory of the decision survives; the personal data does not.
- Consent withdrawal makes the subject's PII unreadable within one job cycle.

## 6. Data subject rights

Access, correction, objection and portability export are implemented as authorised,
audited, rate-limited endpoints (Stage 03 step 7).

## 7. Cross-border processing

Default off. Sending even de-identified text outside `af-south-1` requires a per-tenant
setting and is logged on every call.

## 8. Sections still to be completed

Retention periods per data class, the operator agreement template, and the incident
procedure are written in full during Stage 03, which is where the schedule becomes real
rather than indicative. Anything ambiguous in the meantime goes to `OPEN_QUESTIONS.md` —
POPIA rules are not guessed at.

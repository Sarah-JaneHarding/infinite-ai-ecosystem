# Account provisioning — design draft (OQ-033)

**Status:** DRAFT for the owner's decision. Nothing in this document is built. It follows the
decision that the actor id is `user_account.id` (OQ-033, Stage 112) and answers the part that
decision left open: **how a real person comes to have an account and a role.**

**Scope:** school staff roles — `teacher`, `hod`, `smt`, `sbst`, `admin`. Guardians and learners
are out of scope (see §9). Platform staff have no tenant of their own (see §8).

---

## 1. The problem

Sign-in now resolves the identity provider's `sub` to the school's own `user_account` and uses
that account's id as the actor. Nothing creates that account for a real person. So today a real
staff member can sign in, has no actor, sees no data, and cannot decide a human gate. That fails
closed, which is correct, but it means the product cannot be used by anyone except the seeded dev
logins.

The question is not "can we create rows" — it is **who is allowed to say "this person holds this
role at this school", and what proves that the person signing in is that person.**

## 2. What exists today (verified in the repository)

| Fact                                                                                                                                                                               | Where                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `user_account` is per tenant: `@@unique([tenantId, subject])` and `@@unique([tenantId, email])`; the schema comment says the same human at two schools is two accounts             | `packages/db/prisma/schema.prisma`                             |
| `role_assignment` references `user_account.id`, has optional school/class/subject scope and an `expiresAt`                                                                         | same                                                           |
| `staff_member.userAccountId` is nullable and unique — a staff record can exist before it has a login                                                                               | same                                                           |
| `UserStatus` is `ACTIVE`, `SUSPENDED`, `OFFBOARDED`                                                                                                                                | same                                                           |
| The lookup used at sign-in resolves only an `ACTIVE` account                                                                                                                       | `packages/db/src/user-account.ts`                              |
| The token's `tenant_id` and role claims both come from **Keycloak** (a user attribute and the realm roles)                                                                         | `infra/keycloak/realm.json` mappers                            |
| The onboarding wizard's staff step records only a **count and an import method** — no names, emails or roles                                                                       | `packages/provisioning/src/wizard.ts` `ImportStaffInputSchema` |
| RBAC has a `staff_member` resource (admin: read/create/update) but **no resource for accounts or role assignments**                                                                | `packages/policy/src/rbac.ts`                                  |
| No mail-sending library or SMTP code, and no call to the Keycloak admin API, was found (OQ-021 names a mail account for dunning notices, but no sender exists)                     | grep of `packages`, `apps`, `infra`                            |
| The audit ledger forbids plaintext personal information in an event's `diff`                                                                                                       | `packages/db/src/audit.ts`                                     |
| `docs/SECURITY.md` says MFA is enforced in Keycloak for `admin`, `smt` and `platform_*`, but **`realm.json` contains no MFA, required-action or email-verification configuration** | `docs/SECURITY.md` §7 vs `realm.json`                          |

So today the identity provider is both the authentication source **and** the authority on tenant
and role. This design moves authority over _who holds which role at which school_ into the
school's own data, and keeps the provider for what it is good at: proving a person controls an
email address and a credential.

## 3. Principles

1. **Link on sign-in, grant by an administrator.** First sign-in may _attach_ a provider identity
   to an account an administrator already created. It never creates authority.
2. **A token claim grants nothing.** A role or tenant claim in a token is, at most, a hint that
   must agree with the school's own records. (This also settles OQ-032's source of truth.)
3. **Fail closed, with a reason.** Every refusal is logged and, where safe, explained to the user.
4. **No authority from an unverified email.** Linking requires the provider to assert
   `email_verified = true`.
5. **Everything that confers authority is audited**, in the same transaction as the change.
6. **No personal information in the audit diff or in logs** — refer to the invitation or account
   by id.

## 4. Proposed design

### 4.1 An invitation record

A new tenant-owned table, `user_invitation`:

| Column                               | Notes                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                 | uuid                                                                                                                               |
| `tenant_id`                          | RLS like every tenant table; added to `tables.ts` so the isolation suite covers it                                                 |
| `email`                              | normalised (trimmed, lower-cased); **personal information**, encrypted or access-restricted like other direct identifiers — see §7 |
| `roles`                              | the roles to grant on acceptance (child rows or an array), each with optional school scope                                         |
| `staff_member_id`                    | optional; links the invitee to an existing `staff_member` on acceptance                                                            |
| `status`                             | `PENDING` · `ACCEPTED` · `REVOKED` · `EXPIRED`                                                                                     |
| `expires_at`                         | default 14 days (a number for the owner to set)                                                                                    |
| `created_by`, `created_at`           | the inviting administrator's **account id**                                                                                        |
| `accepted_at`, `accepted_account_id` | set on link                                                                                                                        |

Unique on `(tenant_id, email)` where `status = PENDING`, so one live invitation per address.

**As built in step 1 (2026-10-24), where it differs from the draft above:**

- `roles` is a `text[]` on the invitation, with one optional `school_id` that applies to **all** of the listed
  roles — not child rows with a scope each. Per-role scope is a role change after acceptance (step 3).
- `email` is stored in plaintext behind row-level security, exactly as `user_account.email` already is, rather
  than encrypted: it has to be compared exactly at sign-in, and the neighbouring table sets the precedent.
  It must still never appear in an audit event's `diff`.
- The data layer enforces what the design says the application must: `email` is trimmed and lower-case and
  contains an `@`; `roles` is non-empty and a subset of `teacher, hod, smt, sbst, admin` (a platform, guardian or
  learner role can never be invited, whoever writes the row); one `PENDING` invitation per `(tenant, email)`; and
  `ACCEPTED` if and only if `accepted_at` and `accepted_account_id` are both set. An account is created from at
  most one invitation.
- Forward migrations: `20261024090000_oq033_user_invitation` (table) and `…090100_…_rls` (policy). Rollback:
  `20261024090000_oq033_user_invitation/rollback.sql`, exercised by an integration test.

**Why a separate table rather than a half-built `user_account`:** `user_account.subject` is
required and is the key of the sign-in lookup. A placeholder subject or a nullable subject would
create accounts that exist but cannot be the target of a lookup, weaken the `(tenant, subject)`
uniqueness the whole design leans on, and invite bugs where "an account exists" is mistaken for
"a person has signed in". With an invitation table, **every `user_account` is a real, linked
person.**

Requires a forward migration and a tested rollback (rule 10). No existing table changes.

### 4.2 Roles are granted at acceptance, from the invitation

On accept, in one transaction: create the `user_account` (subject, email, display name from the
provider), create its `role_assignment` rows from the invitation, set `staff_member.userAccountId`
if linked, mark the invitation `ACCEPTED`, append the audit events.

### 4.3 First sign-in algorithm

```
on sign-in (provider profile P, tenant claim T):
  1. require P.email_verified === true and T is a UUID of an ACTIVE tenant   → else refuse
  2. account = ACTIVE user_account in T with subject = P.sub
       found                                                                 → resolve (today's path)
  3. not found: invitation = PENDING, unexpired user_invitation in T with
       email = normalise(P.email)
       none                                                                  → refuse "no invitation"
  4. accept the invitation (§4.2) — one transaction, serialised on the
     invitation row; a concurrent second sign-in finds it already ACCEPTED
     and resolves the account created by the first
  5. a SUSPENDED / OFFBOARDED account with this subject                      → refuse, never relink
```

Only step 4 writes. It runs as a dedicated, narrow database path (not the session's own
privileges — the person has no account yet), which is a security-boundary decision in itself: see
§10, question 6.

### 4.4 Where the session's role comes from

The session role becomes the intersection of **the account's active `role_assignment` rows** and
**the provider's role claim**:

- a role in the claim but not in the database → ignored (the claim grants nothing);
- a role in the database but not in the claim → ignored for this session, and logged (the
  provider is out of sync; see §5);
- exactly one role in the intersection → that role;
- more than one → the person chooses at sign-in (resolves OQ-032 with a chooser, never a
  privilege ranking);
- none → the sign-in is refused.

This keeps `session.role` — and so `ROUTE_ACCESS`, the proxy and the pages — unchanged.

### 4.5 Administrator operations

New routes, each behind `authorize()`, each audited in the same transaction:

| Operation                                            | Rule                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Invite staff (email + roles + optional school scope) | admin only; the inviter's account id is recorded                             |
| Revoke an invitation                                 | admin only                                                                   |
| Grant / revoke a role on an existing account         | admin only; see the guard-rails below                                        |
| Suspend / offboard an account                        | admin only; takes effect at the next sign-in and at every gate decision (§6) |
| List accounts and pending invitations                | admin only                                                                   |

**Guard-rails** (each a test, each a decision for the owner — §10):

- a tenant administrator can never grant a `platform_*` role;
- nobody can change **their own** roles;
- the last `admin` of a tenant cannot be removed or demoted;
- granting a role that can decide human gates (`hod`, `smt`) or administer (`admin`) is the
  sensitive act. Recommended: it is audited with the inviter and, for `admin` and `smt`, requires a
  second administrator to confirm (rule 6's spirit — authority over gates should not be a
  one-person decision).

RBAC gained three resource types, all admin-only (built in step 2, `packages/policy/src/rbac.ts`): `user_account`
(read; update = suspend / offboard — **no create**, because an account is made by a person's first sign-in linking
to an invitation), `role_assignment` (read; create = grant; delete = revoke; approve = confirm another
administrator's grant of `admin` or `smt`) and `user_invitation` (read; create = invite; update = revoke). The draft
named two; the invitation is a third because it holds an address that should not be readable through account listing.
The guard-rails are pure functions in `packages/policy/src/provisioning.ts`, one reason per refusal.

**The last administrator.** A single change can never remove a school's last administrator, and no branch is needed
to say so: the actor must be an active administrator and cannot be the target, so whenever the target is an
administrator the actor is a second one. The unit test checks that exhaustively over every small school. The real
hazard is a **race** — two administrators demoting each other at the same moment both pass against the same snapshot
and leave none. That is closed where the change commits (step 3): the school's administrators are locked and
re-counted inside the transaction, and the rules are evaluated against that count. Step 3 must carry a concurrency
test for exactly this.
The existing `staff_member` grant is not enough, and widening it would blur "a staff record" with
"authority to act".

### 4.6 The first administrator

A tenant with no administrator cannot invite anyone. The bootstrap must not be a back door:

- the platform operator creates the tenant and one `user_invitation` for the school's named
  principal with role `admin` — through the provisioning flow, not by writing rows by hand;
- platform staff gain **no** read access to the school's data by doing this: they create the
  invitation (a write to a narrow, audited path), nothing more;
- the invitation is the only artefact; the principal then signs in, verifies their email and is
  linked like anyone else.

This needs the tenant-creation path in `packages/provisioning` to produce the invitation, and an
operator-only entry point. It also forces a decision on what the platform may write into a school
(§10, question 7).

## 5. The identity-provider side

Today Keycloak users, their `tenant_id` attribute and their realm roles are created by hand. That
does not scale past the pilot's three schools, and it is where authority currently leaks, so the
design has to say what happens there.

**Recommendation:** an admin invitation triggers creation of the Keycloak user through the Keycloak
Admin API, using the worker's existing service-account client, with:

- the `tenant_id` attribute set from the invitation's tenant;
- the realm role(s) mirrored from the invitation (needed so Keycloak's own policies, notably MFA,
  can key on them — §4.4 keeps the database as the authority);
- required actions `VERIFY_EMAIL`, `UPDATE_PASSWORD`, and `CONFIGURE_TOTP` for the roles that must
  have MFA;
- Keycloak's own "execute actions" email delivering the link, so **Keycloak** is what verifies the
  address — the application sends no email in this design.

**For the pilot** the operator may create Keycloak users by hand instead (three schools), with the
application doing everything else in §4. The linking logic is identical either way, which is why
the Keycloak integration can come last.

**Things that must be true of the Keycloak realm, none of which the repository currently proves:**

- email verification is required (`verifyEmail`), so `email_verified` means something;
- no federated login from a provider that does not verify email;
- MFA actually enforced for `admin`, `smt` and the platform roles. `docs/SECURITY.md` §7 says it
  is; **the realm file has no configuration for it.** Either it is configured out of band in the
  real environment (then record where) or the claim is untrue today. This should be checked before
  pilot regardless of this design — it is a standing documentation/reality gap.

## 6. Account lifecycle and stale sessions

A session's account is fixed at sign-in. Suspending an account therefore does not end an existing
session. Two cheap mitigations, both recommended:

- `decideHumanGate`'s existing role check also requires the deciding account to be `ACTIVE` (today
  it checks only the role assignment);
- shorten the application session's lifetime, or re-check account status periodically. `auth.ts`
  sets no `maxAge`, so next-auth's default (30 days) applies, while `docs/SECURITY.md` §7 describes
  30-minute refresh tokens at the provider — the application session outlives them by a wide margin.

Offboarding sets `OFFBOARDED`, expires role assignments (`expiresAt`), and leaves audit and consent
history intact (OQ-022). It never deletes the row.

## 7. POPIA and data handling

- A staff member's email is personal information. It is **not** learner information, but it is held
  to the audit ledger's rule: never in an event's `diff`. Events refer to the invitation or account
  by id.
- The invitation's email should be treated like other direct identifiers (access-restricted;
  consider encryption at rest with the existing key service) and deleted or blanked a fixed period
  after acceptance, expiry or revocation. The retention period is a **school determination**
  (OQ-007), not mine to set.
- Purpose: provisioning and authentication of staff. Should be added to the purpose table in
  `packages/contracts/src/popia/purpose.ts` rather than read under an existing purpose.
- Refusal messages must not reveal whether an address has an invitation (no enumeration): the user
  sees a generic "ask your administrator", the log records the reason.

## 8. Platform staff

`platform_support` and `platform_admin` have no tenant of their own and no account at any school;
they reach a school's data only through the (not yet built) administrator-approved, time-limited
support session. This design neither changes nor depends on that. It does mean platform sign-ins
must keep resolving **no** actor, and a test should pin that.

## 9. Out of scope — needs its own design

- **Guardians.** Linking a guardian to a learner is a POPIA consent matter (`consent_record`), not
  an administrator granting a role. The link must come from the school's learner records and the
  guardian's own consent, and no guardian may see a learner they are not linked to.
- **Learners.** Children. Whether a learner has a login at all, with what identifier (no email), and
  who acts for a Foundation Phase child are policy questions I have not found a source for.
- **Bulk import.** The wizard's staff step takes a count, not people. Importing a staff list (CSV /
  SA-SAMS) that creates _invitations_ — never accounts — is a natural extension once §4 exists, and
  needs its own column-mapping and validation design.
- **SSO / SCIM** for school groups that already run an identity provider.

## 10. Threats considered

| Threat                                                                 | Mitigation in this design                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Someone registers the invitee's address at the provider before they do | Verified email is required; Keycloak's verification link proves control of the address. Residual risk: a compromised mailbox. An optional secret token in the invitation link would close it; deferred as an owner decision |
| Provider administrator error puts a user in the wrong tenant           | A `tenant_id` claim alone grants nothing: linking needs a pending invitation **in that tenant** for that verified address                                                                                                   |
| Provider role claim inflated or edited                                 | The claim is intersected with the database; it cannot add a role                                                                                                                                                            |
| Tenant admin escalates (self-grant, platform role, last-admin removal) | §4.5 guard-rails, each tested                                                                                                                                                                                               |
| Two concurrent first sign-ins race                                     | Acceptance serialised on the invitation row; unique `(tenant, subject)` and `(tenant, email)` are the backstop                                                                                                              |
| Address reuse after offboarding                                        | A `SUSPENDED`/`OFFBOARDED` account with that subject is never relinked; a new person with the same address needs a new invitation and gets a new account                                                                    |
| Email changed at the provider                                          | Linking is by `sub` once an account exists, so a changed address cannot capture another account; a changed address on an unlinked invitee simply fails to match                                                             |
| Plus-addressing / case / Unicode lookalikes                            | Normalise on write and lookup; compare exactly after normalisation; no fuzzy matching                                                                                                                                       |
| Invitation enumeration                                                 | Generic refusal text; per-IP and per-tenant rate limits on sign-in failures (Keycloak brute-force protection already covers the credential, not this lookup)                                                                |
| Stale session after suspension                                         | §6                                                                                                                                                                                                                          |
| Unaudited authority                                                    | §4.5, same-transaction audit events                                                                                                                                                                                         |

## 11. Delivery plan (each step a PR with its own tests)

1. **Schema + migration + rollback** for `user_invitation`; register in `tables.ts`; RLS isolation
   test (a second tenant cannot read or accept the first's invitations).
2. **RBAC** _(built — Stage 114)_: `user_account` and `role_assignment` resources and admin grants; matrix tests; the
   guard-rails as pure functions with tests (no self-grant, no platform role, last admin).
3. **DB functions** (including the concurrency test for two administrators demoting each other, §4.5): create/revoke invitation, accept (link) transaction, grant/revoke role,
   suspend/offboard — each audited; concurrency test on acceptance.
4. **Sign-in integration**: §4.3 and §4.4 in the `jwt` callback; refusal reasons; tests for every row
   of the table in §4.3 and for platform sign-ins resolving no actor.
5. **Admin UI** (`/admin/staff`): invite, revoke, list, role changes; wired to the routes.
6. **Gate decision hardening** (§6): require an `ACTIVE` account in `decideHumanGate`.
7. **Keycloak integration** (§5): Admin API client, mirrored roles, required actions; realm config
   for email verification and MFA, with a drift test like the dev-identities one.
8. **Dev stack**: replace `db:seed:identities` with seeded _invitations_ so the dev flow exercises
   the real path.

Steps 1–6 are testable without Docker only in their unit tier; the isolation, concurrency and
migration tests are integration tests and run in CI.

## 12. Decisions needed from the owner

1. **Invitation lifetime** (default proposed: 14 days).
2. **May a school administrator grant `admin`?** And is a second administrator's confirmation
   required to grant `admin` or `smt`? (Recommended: yes to both, for the reason in §4.5.)
3. **One active role per session, chosen at sign-in** (§4.4) — acceptable, or must a person act in
   several roles at once?
4. **Link on verified email alone, or also a secret token in the invitation link?** (Recommended:
   email alone for the pilot; add the token if a school's mailboxes are shared or weakly secured.)
5. **Who creates Keycloak users for the pilot** — the operator by hand, or build the Admin API
   integration first?
6. **The sign-in write path.** Accepting an invitation writes before the person has any account, so
   it cannot run as them. It needs a narrow database role or `SECURITY DEFINER` function limited to
   "accept the pending invitation matching this verified email in this tenant". That is a
   security-boundary decision, like OQ-030's tenant directory. _(Refined in §12.2: it can in fact run as the application role inside the tenant context from the token's tenant claim, so the question is how much to narrow that role, not how to get around isolation.)_
7. **What the platform operator may write into a school** to create the first administrator's
   invitation, and how that is audited.
8. **MFA reality check** (§5): is it configured anywhere? Who owns fixing `SECURITY.md` or the realm?
9. **Retention of invitations** after acceptance/expiry — the school's determination (OQ-007).
10. **Guardian and learner provisioning** — commission separate designs (§9).

## 12.1 Decisions recorded 2026-10-24

The owner asked the implementer to answer the five questions below. They are answered here so work can
proceed; each is **reversible until the step that depends on it ships**, and the owner can overrule any of
them. (Numbers refer to the list in §12.)

| Question                                                                                                         | Decision                                                                                                                                                                                                                                                                        | Why                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — May an administrator grant `admin`? Is a second administrator's confirmation required for `admin` and `smt`? | **Yes** to granting `admin`. A second administrator **confirms** a grant of `admin` or `smt` **when the tenant has two or more active administrators**. A **sole** administrator may grant without confirmation, and the audit event records that no confirmation was possible. | Authority over human gates (`hod`, `smt`) and over accounts (`admin`) should not be a one-person decision (rule 6's spirit). But a small primary may have exactly one administrator; requiring a second would deadlock it. The audit marker keeps the exception visible. The first `admin` of a tenant comes from the operator's bootstrap invitation (§4.6). |
| 3 — One active role per session, chosen at sign-in?                                                              | **Yes.** More than one role in the intersection of the account's assignments and the provider's claim → the person chooses; exactly one → that one.                                                                                                                             | Keeps `session.role`, `ROUTE_ACCESS` and the proxy unchanged; avoids a privilege ranking nobody has ratified (OQ-032). Acting in two roles at once can be added later without undoing this.                                                                                                                                                                   |
| 4 — Verified email alone, or also a secret token?                                                                | **Verified email alone** for the pilot. Revisit with a secret token in the link if a school's mailboxes are shared or weakly secured.                                                                                                                                           | Keycloak's verification link already proves control of the address, and the invitation must exist in that tenant. A second secret mainly helps against a compromised mailbox, which the pilot's three schools can be asked about directly.                                                                                                                    |
| 5 — Who creates Keycloak users for the pilot?                                                                    | **The operator, by hand,** for the three pilot schools. The Admin API integration stays at step 7.                                                                                                                                                                              | Everything in steps 1–6 (linking, roles, guard-rails, UI) works identically either way; the integration is the largest piece and the only one that needs a running Keycloak to test.                                                                                                                                                                          |
| 8 — Is MFA configured anywhere?                                                                                  | **Not answerable by the implementer.** Until the owner confirms, **treat MFA as not enforced**. Recorded as **OQ-036**; `docs/SECURITY.md` §7 now carries a note.                                                                                                               | `SECURITY.md` says it is enforced, but `infra/keycloak/realm.json` configures none, and the production realm is not in the repository. The owner (or whoever operates Keycloak) has to look. Step 7 adds the realm configuration with a drift test, so the repository stops depending on memory.                                                              |

Still open: 1 (lifetime; 14 days is the working default), 6, 7, 9, 10.

## 12.2 Recommendations for the decisions still open

These are **recommendations, not decisions**; each says what it rests on and what it does not know.

**6 — The sign-in write path.** Do it in the application for the pilot: one `acceptInvitation` function in
`packages/db`, run inside `withTenant` as `app_rw` using the tenant claim, in a single transaction that locks the
invitation row, refuses unless the provider asserted `email_verified`, and writes the account, role assignments and
audit events together. Do **not** introduce a `SECURITY DEFINER` function yet. Why: (a) this corrects the draft — the
tables are `FORCE ROW LEVEL SECURITY`, so a definer function owned by the table owner is _still_ bound by the tenant
policy; it would add privilege separation, not an isolation bypass; (b) `app_rw` already has blanket DML on every
table through default privileges (`infra/docker/initdb/02-roles.sh`), so narrowing it for these tables alone is a
repository-wide hardening decision, and the migrations contain no `SECURITY DEFINER` precedent; (c) the database
already enforces the invariants that matter whoever writes — the staff-role list, one pending invitation per address,
acceptance consistency. The residual risk is that any code holding a tenant context could write `role_assignment`.
Mitigate with a test that only the db package writes it (like the guard against `token.sub`), same-transaction
audit, and — as a later hardening — a dedicated `provisioner` database role with `INSERT` on these tables that is
revoked from `app_rw`. _Not known:_ whether a second connection pool is acceptable operationally.

**7 — Bootstrapping a school's first administrator.** An operator-run command in `packages/provisioning`, run in the
deploy environment — not a web route — that creates the tenant (the wizard's existing `create_tenant` step) and
**one** `user_invitation` for the named principal with role `admin`, `created_by` null, with an audit event whose
diff holds the invitation id and no address. Platform staff therefore gain no read access to the school by doing
this, and need no RBAC grant for it. Because everything downstream trusts that one invitation, verify the principal
out of band first: a written request on the school's letterhead and a call-back to the school's published number.
Go-live readiness should then require **two** active administrators (principal plus a deputy), or an explicit,
recorded acknowledgement of the sole-administrator exception from §12.1. _Also found:_ `docs/ONBOARDING_GUIDE.md`
Step 4 uses role names that are not in the system (`principal`, `head_of_department`, `educator`, `support_educator`,
`admin_staff`) and says accounts are created at that step; it should be reconciled with the real roles
(`admin`, `hod`, `teacher`, `sbst`, `smt`) and with link-on-sign-in when step 5 builds the admin screen.

**9 — Retention of invitations.** Keep a `PENDING` invitation until it is accepted, revoked or expires; then delete
the row about 90 days after it reaches a terminal state. The durable record is the audit event (invitation id,
roles, inviter, confirmer, outcome — no address), which the ledger rules already retain (OQ-007, OQ-022); an accepted
invitation's address already lives in `user_account.email`, so deletion loses nothing needed. Hold it as a retention
rule loaded through the school's schedule (`pnpm check:retention`), with a real `authority` and `ratifiedBy`, rather
than hard-coding it; with the existing `RECORD_CREATED` anchor, roughly 120 days covers a 14-day invitation plus 90.
**90 days is my working proposal, not a legal determination** — it is the school's to ratify (OQ-007). _Not
verified:_ that the retention machinery can delete from this table; check before relying on it.

**10 — Guardians and learners.** Commission separate designs, and for the pilot **issue neither a login.**
Guardians: `guardian` and `guardian_link` already exist, `consent_source` already has `PAPER_FORM` and
`STAFF_CAPTURED`, and the pilot's consent metric (`PILOT_PROTOCOL.md`) can be met by staff capturing consent from
paper forms — so a guardian portal is not on the pilot's critical path. When it is designed, a guardian's access
should come from the school's own guardian-to-learner link (which `guardianOfLearnerIds` already models), not from an
administrator granting a role. Learners: the learner surface (`packages/learner-client`) works offline on school
devices; whether a child has an individual login, with what identifier (no email), and who acts for a Foundation Phase
child are POPIA special-care questions for the owner and the school's information officer, and I have found no
source to design from. Until then the `guardian.dev` and `learner.dev` Keycloak users have no accounts and resolve no
actor, which is the safe state.

**OQ-036 — MFA (see `OPEN_QUESTIONS.md`).** Have someone with Keycloak admin access export the production realm
(Admin console → Realm settings → Action → Partial export, or `kc.sh export`) and check four things: the browser
authentication flow requires OTP for `admin`, `smt` and the platform roles (conditional on role) or sets the
`CONFIGURE_TOTP` required action when the account is created; **Verify email** is on; brute-force detection is on; and
no identity provider is federated that does not verify email. Then either commit the sanitised export (no secrets) so
the repository finally describes the real realm, with a drift test like the dev-identities one, or configure what is
missing and correct `SECURITY.md`. Until confirmed, treat MFA as absent: do not make the claim to schools, and limit who
holds `admin` and `smt` in the pilot to named individuals. Do this before the pilot and before step 7. _Unverified:_
the exact Keycloak 26 menu and flow names above are from my knowledge of the product and should be checked.

## 13. Not verified

- Keycloak 26's exact Admin API calls and required-action names — from knowledge of the product,
  not exercised here; check against the running version.
- Whether the production Keycloak realm differs from `realm.json` (MFA, email verification).
- That `execute-actions-email` can be delivered from the pilot environment (needs Keycloak SMTP
  configured; OQ-021 names a mail account for dunning, not for Keycloak).

## 14. Sources consulted

`docs/OPEN_QUESTIONS.md` (OQ-021, OQ-022, OQ-030, OQ-032, OQ-033); `docs/SECURITY.md` §7;
`docs/PILOT_PROTOCOL.md` (staff invitation acceptance metric); `CLAUDE.md` (rules 5, 6, 10, the
stop-and-ask list); `packages/db/prisma/schema.prisma` (`UserAccount`, `RoleAssignment`,
`StaffMember`, `UserStatus`, `AuditEvent`); `packages/db/src/user-account.ts`, `roles.ts`,
`audit.ts`; `packages/policy/src/rbac.ts`; `packages/provisioning/src/wizard.ts` and README;
`packages/school-setup/README.md`; `apps/web/src/auth.ts`; `infra/keycloak/realm.json`.
No external standards or vendor documentation were consulted.

# Verify MFA and individual sign-in

**Audit tasks:** T12 (individual authentication) and T13 (deployed MFA and network protection). Open question: OQ-036.
**Status: written 2026-11-26, not yet run.** Until Part A and Part B are done and recorded, **do not tell a school MFA is enforced**
(`docs/SECURITY.md` §7 says the same).

**Owner:** the person who operates Keycloak. **Needs:** Docker (Part A), and administrator access to the production Keycloak realm (Part B).

## What this proves, and what it does not

| Claim                                                           | Proved by                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| The committed realm file says MFA is required for five roles    | A drift test, already passing (`keycloak-realm-mfa.spec.ts`) |
| Keycloak **imports** that file and actually asks for a code     | **Part A** (a live Keycloak, today unrun)                    |
| The **production** realm enforces it, and has no dev accounts   | **Part B** (needs the real realm)                            |
| Accounts are individual, revocable, and no open dev mode exists | **Part C**                                                   |
| Sessions and transport are protected                            | **Part D**                                                   |

The five MFA roles in `infra/keycloak/realm.json` are `admin`, `smt`, `sbst_chair`, `platform_support` and `platform_admin`
(`SECURITY.md` §7). `teacher`, `hod`, `sbst`, `guardian` and `learner` are asked for a password only. See the decision at the end.

## Part A — does Keycloak accept the realm file and ask for a code? (local)

1. Put the secrets in your local `.env` (never commit it; `.env.example` holds names only). The compose file refuses to start without them.
2. `docker compose -f infra/docker/compose.dev.yml up -d keycloak`, then wait until it reports `healthy`. A restart loop with
   `invalidPasswordMinLowerCaseCharsMessage` means the dev password you set does not meet the realm's policy (12+ characters, upper, lower, digit, special).
3. Sign in to the web app as **`admin.dev`**. **Expect:** Keycloak asks you to set up an authenticator app (QR code), then for a code. Sign out and in again: it asks for a code every time.
4. Sign in as **`chair.dev`** (roles `sbst` and `sbst_chair`). **Expect:** a code is asked for.
5. Sign in as **`teacher.dev`**. **Expect:** **no** code.
6. Sign in as **`platform-admin.dev`** and **`platform-support.dev`**. **Expect:** a code, for each.
7. Try an unverified address if you can create one. **Expect:** Keycloak requires email verification (`verifyEmail` is on).
8. Try five wrong passwords on a throwaway user. **Expect:** the account locks (`bruteForceProtected` is on).

Record pass or fail for each line. **If step 3 does not ask for a code, MFA is not enforced** whatever the file says.
Update `docs/OPEN_QUESTIONS.md` OQ-036 with the result.

## Part B — the production realm (the real answer)

**Hazard to clear first.** `realm.json` defines eleven `*.dev` users, including `admin.dev` (role `admin`) and `platform-admin.dev`
(role `platform_admin`), each with an initial password taken from an environment variable. OQ-036 says the production realm "must be created from
this file". I found **no document or script in the repository that removes those users first**. Importing the file unchanged would create
real administrator accounts with a password you may have shared around for development.

Before any production import: **remove every `*.dev` user from the copy you import**, or import without users and create real ones
through the application's invitation flow. Afterwards, confirm in the Keycloak admin console that **no user's name ends in `.dev`**, and that
`SEED_USER_PASSWORD` was never set in production.

Then export the production realm (Keycloak admin console → Realm settings → Action → Partial export, or `kc.sh export`) and check:

| #   | Check                                                                                                         | Expected                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Realm **browser flow** is `browser-mfa`                                                                       | Yes                                                                                               |
| 2   | Conditional OTP sub-flows exist for all five roles                                                            | `admin`, `smt`, `sbst_chair`, `platform_support`, `platform_admin`                                |
| 3   | Required actions `CONFIGURE_TOTP` and `VERIFY_EMAIL` are enabled                                              | Yes                                                                                               |
| 4   | **Verify email** is on                                                                                        | Yes                                                                                               |
| 5   | **Brute-force detection** is on                                                                               | Yes                                                                                               |
| 6   | No identity provider that **skips** email verification or MFA (social or federated sign-in)                   | None, or each one checked                                                                         |
| 7   | **SSL required** is not `none`                                                                                | `external` or `all`                                                                               |
| 8   | No `*.dev` user; no user holding `admin` or a platform role who is not a named person                         | None                                                                                              |
| 9   | Client secrets for `infinite-ai-web`, `-worker` and `-provisioner` are strong, unique, and not the dev values | Yes (check by rotating, not by reading them)                                                      |
| 10  | The provisioner service account has user-management roles only, and **no** realm-admin role                   | Yes (OQ-048: `manage-users` can map any role, so treat its secret as an administrator credential) |

Commit a **sanitised** export (no secrets, no users) with a drift test, or correct `SECURITY.md` §7 to say what is true.

Then sign in to the real application as a real `admin` and confirm the code is asked for. A configuration that reads correctly but is
never exercised is exactly what OQ-036 was raised about.

## Part C — individual accounts and revocation (T12)

1. **No open or development sign-in exists in what is deployed.** On a static read, the Education web app registers only the Keycloak provider (`apps/web/src/auth.ts`: no credentials or self-declared identity path). Confirm the **deployed** build is that code, and check the deployed variables in the task definition or secrets manager (`/admin/env` documents the variables; it does not show deployed values). The audit's "open development mode" finding (R03) is about the separate Operations platform, which is not covered here.
2. Every pilot participant has **their own** account, created through the invitation flow, with a role that matches their job.
3. **Revocation works.** Disable a test user in the application's staff screen. **Expect:** their next request is refused and their sessions end (the provisioner ends sessions before disabling). Time it.
4. **Role removal works.** Revoke a role from a test user; confirm the pages for that role are no longer reachable.
5. Nobody signs in as a service account, and the worker and provisioner client secrets are stored in the secrets manager, not in a person's files.

## Part D — network and session protection (T13, second half)

1. The site is reachable **only over HTTPS**; plain HTTP redirects. Check the certificate and the expiry date.
2. Keycloak's admin console is **not** open to the whole internet; it is restricted to named people or a network.
3. Access tokens expire after 5 minutes and refresh tokens after 30 (`SECURITY.md` §7). Confirm the realm's actual values, not the document's.
4. After sign-out, the back button and a copied URL do not return a signed-in page.

## Lost authenticator — a gap to decide, not a procedure that exists

Five roles must enter a code, including `admin` and both platform roles. The realm configures **no recovery codes**. If the only administrator loses their
phone, they cannot sign in, and nothing in this repository describes the recovery. Before relying on MFA decide who can reset another person's authenticator,
and keep a break-glass Keycloak administrator (with its own MFA and an offline copy of its recovery details) separate from application admins.
That is a decision for the owner, logged below; do not invent a recovery path.

## Decisions for the owner

1. Should **`hod`** (who approves artefacts) and **`sbst`** (who sees support-team material) also require a code? Today they do not; `sbst_chair` does. This is your call.
2. Who may reset another person's authenticator, and who holds the break-glass administrator?

## What to record afterwards

Part A: each line pass or fail, with the date and Keycloak version. Part B: the checklist, the date, and whose export it was (no secrets in it).
Parts C and D: pass or fail with times. Put a summary in `docs/STAGE_LOG.md`; close or update OQ-036; correct `docs/SECURITY.md` §7 to say what was
verified; and set `docs/FEATURE_MATRIX.md`'s sign-in row accordingly.

## Which test would have caught this earlier

The drift test already guards the file. What is missing is a test that **runs** Keycloak and asks for a code (a browser test against the dev realm), and a
guard that fails the import of a realm containing `*.dev` users outside development. Neither is built.

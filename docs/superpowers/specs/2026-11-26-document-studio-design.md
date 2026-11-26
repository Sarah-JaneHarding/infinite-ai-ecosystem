# Document Studio and the 120-document library — design

Status: **draft for approval** (2026-11-26). Nothing in this document is built.
Size: a project. Delivered as about six small PRs (see "Delivery").

## Intent and the why

Infinite-AI has 120 business documents (contracts, policies, SOPs, forms, registers,
workbooks) supplied as a library: `manifest.json` plus, for each document, `.json` (typed
blocks), `.md`, `.html`, `.docx` and, for 22 workbooks, `.xlsx`. Every one is a **draft** with
`[Fill in: …]` blanks (748 across the JSON files), and 56 are marked "Needs review" by a
qualified person.

The operator wants these inside the **operations platform**, in a **Document Studio** where
Infinite-AI staff can review each document, edit it, save it in a chosen file type,
countersign it, ratify it, and — only after that — press an **Ingest** button that sends it
into the Infinite Brain.

The why: the documents are the company's own paperwork. They should be worked on in one
place, with a record of who changed and who approved what, and then become something the
Brain can recall, without anyone being able to claim an approval that did not happen.

## Goals

1. All 120 documents are loaded, idempotently, with their library metadata and file hashes.
2. A studio page lists them (filter by department, group, kind, status) and opens one.
3. Edit, with a required reason, makes a **new revision**. History is never rewritten.
4. Save/download in a chosen file type: `.docx`, `.xlsx` (workbooks), `.html`, `.md`, `.json`.
5. Gates, in order: **review → countersign → ratify**, each a named signed-in human, each
   bound to the revision's sha256.
6. **Ingest** is enabled only for a ratified revision and creates a Brain write candidate.
7. Every state change writes an audit-ledger entry, a trace span and has tests (Definition of
   Done).

## Non-goals

- Not a general-purpose word processor: edits are to the typed blocks (heading, paragraph,
  key-value, table, list, checklist, callout), not free-form layout.
- No e-signature legal validity claim. A countersign here is an internal approval record,
  not an advanced electronic signature under ECTA. If a document needs a legally binding
  signature, that happens outside the studio.
- No tenant-facing (school) access. Schools do not see this studio.
- No automatic filling of `[Fill in: …]` blanks.
- No new approvals are invented. All 120 import as `DRAFT`.

## Anti-goals (failure even if it "works")

- A document showing as ratified or countersigned without a real named human's record.
- A "Needs review" document ratified as though a qualified person had checked it.
- A signature that survives an edit to the content it signed.
- Ingest reachable for an unratified revision, by any route, flag or env var.
- Library content reaching a school tenant's Brain or database.

## Constraints (from `CLAUDE.md`)

- Rule 5 / invariant 1: all reads and writes through `withTenant`; new tables are classified
  in `packages/db/src/tables.ts` and covered by the RLS suite.
- Rule 6: the approval record exists before the guarded transition commits; no skip flag.
- Rule 9: any new dependency recorded in `docs/DEPENDENCIES.md` (MIT/Apache/BSD/ISC only).
- Rule 10: forward migration plus a tested rollback; migrations that add tenant-owned
  tables follow the `20260729160000_stage03_popia_tables` pattern (tenant context set first).
- Rule 11 / invariant 4: signatures are append-only (trigger refuses UPDATE and DELETE).
- Rule 8: strict TypeScript, Zod contracts for every API surface plus contract tests.
- No `process.env` outside `packages/config`; no `console.log`.
- Each PR ≤ ~400 changed lines excluding generated files; docs updated in the same commit.

## Approaches considered

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| **A** | Infinite-AI is an **operator tenant**; new tenant-owned tables; studio at `/platform/library`; files generated on demand from block JSON | Needs one operator-tenant row and a docx/xlsx dependency | **Chosen** (operator picked A) |
| B | New platform-scoped table class outside tenancy | First exemption in the isolation proof; second query path | Rejected |
| C | Extend the Widget Studio pattern with no database | Nothing persists, so signatures would be lost | Rejected |

## Design

### Data model (operator tenant, tenant-owned, RLS)

- `library_document` — one row per library id (`lib-nda`): title, group, dept, kind,
  `review_by` (the "Needs review" role, nullable), `law` (pointers), `current_revision_id`,
  `source_manifest_sha256`.
- `library_revision` — append-only per document: `revision_no`, `content_json` (the blocks),
  `content_sha256` (hash of canonical JSON), `status` (`DRAFT | REVIEWED | COUNTERSIGNED |
  RATIFIED`), `edited_by`, `edit_reason`, `parent_revision_id`, optional `original_xlsx`
  reference (see "Workbooks"). Revision 1 is the import; its hash must match the manifest's
  `.json` sha256.
- `library_signature` — **append-only** (trigger refuses UPDATE/DELETE; listed in
  `APPEND_ONLY_TABLES`): `revision_id`, `content_sha256`, `kind (REVIEW | COUNTERSIGN |
  RATIFY)`, `signer_actor_id`, `reason`, `attestation` (for "Needs review" documents),
  `signed_at`.
- `library_ingest` — one row per Brain submission: `revision_id`, `content_sha256`,
  `brain_write_candidate_id`, `actor_id`, `created_at`. Unique on `(revision_id)` so Ingest
  is idempotent.

A revision's effective status is **derived** by replaying its signatures (as
`policy/consent.ts` does), not stored as a mutable flag. `status` above is a cached view
that tests assert equals the replay.

### Operator tenant

Documents live in one designated tenant (the "operator tenant", configured by tenant id in
`packages/config`). Platform staff act inside it through the normal `withTenant` client; no
school's tenant context is ever used. If no operator tenant exists in an environment, the
seed refuses and says so (see Open items).

### Roles

- `platform_support`: view, download.
- `platform_admin`: all of the above, plus edit, review, countersign, ratify, ingest.
- Enforced in the RBAC matrix (`packages/policy/src/rbac.ts`) as declarative rows, with a
  security test per denied combination.

### Gate rules (pure functions in a new `packages/library-studio`, no I/O)

1. **Edit** → inserts a new revision (`DRAFT`), reason required, actor recorded. Prior
   signatures stay on the old revision and do not carry over.
2. **Review** → a named human signs the revision hash. For a document with a `review_by`
   role, the signer also supplies an attestation of who they are and what they reviewed; the
   studio never states that a qualified person reviewed it.
3. **Countersign** → requires a REVIEW on the same hash; the signer must be a **different
   person** from the editor of that revision and from the reviewer.
4. **Ratify** → requires REVIEW and COUNTERSIGN on the same hash; signer is a
   `platform_admin` and may not be the editor; reason required.
5. **Ingest** → requires RATIFY on the current revision's hash. Refused otherwise, with a
   reason the UI shows.

The signature record is written in the same transaction as the derived-state change; the
check "the record exists first" is a test (rule 6). There is no bypass flag.

### Files (save with file-type selection)

- Source of truth is `content_json`. Generated on demand: `.md`, `.html`, `.json`, `.docx`.
- **Workbooks (22 files).** The supplied `.xlsx` files contain live formulas (for example
  303 in the debtors ageing, 123 in the budget workbook). Regenerating from JSON would
  drop them. So for workbooks the `.xlsx` download returns the **supplied binary unchanged**
  for revision 1, and the studio edits only the document blocks; the page says plainly that
  spreadsheet cells are edited in Excel and re-uploaded as a new revision (upload accepts
  `.xlsx` only, hashes it, and records it on the new revision). `.docx` and `.html` are still
  generated from the blocks.
- Library: a small DOCX writer is needed. Candidate: `docx` (MIT). To be confirmed and
  recorded in `docs/DEPENDENCIES.md` before use. `.xlsx` generation is **not** needed under
  this design, so no spreadsheet-writing dependency is added; reading a replaced `.xlsx`
  for its hash and sheet count needs none.
- Every download names the revision number and short hash in the filename and header, and
  adds an unratified watermark line in `.md`/`.html`/`.docx` until RATIFIED.

### Ingest into the Brain

- Button calls `POST /api/platform/library/[id]/ingest` (Zod body: revision id, sha256).
- Handler re-derives status from signatures; refuses unless RATIFIED for that hash.
- Submits a write candidate for the operator tenant's Brain with kind `TEMPLATE`, source
  `library:<id>:<revision_no>`, status `AWAITING_RATIFICATION`. Idempotent per revision.
- **My call:** the Brain's own ratify step remains. Ingest queues; a human in the existing
  Brain flow finishes it. This keeps rules 6 and 11 and adds no bypass.
- Supersession: a later ratified revision submits a new version; the old Brain fact is
  superseded by the Brain's normal path, never updated in place.
- Documents with unfilled `[Fill in: …]` blanks may be ingested (they are templates) but the
  candidate carries `unfilledBlanks: n` and the UI warns before the button is pressed.
- The library contains no learner personal information (the NDA itself states this); the
  seed runs a check that fails if a block matches the PII detector, as a guard.

### UI (`/platform/library`)

List (search; filter by department, group, kind, status; counts per department; a "needs
review" badge) → document page with: block editor (click to edit, reason box, **Save as new
revision**), revision history with diffs, signature timeline (who/when/hash), file-type
picker with **Download**, gate buttons that show only what the signed-in person may do now
and why the others are disabled, and **Ingest to Brain**. Nav entry added for
`platform_admin` and `platform_support`. Mockups are a plan-time task, not decided here.

### Ingestion of the library itself

`pnpm library:seed` — reads `library/manifest.json`, verifies every file's sha256, validates
each `.json` against a Zod block schema, and upserts `library_document` and revision 1.
A second run is a no-op. Any hash mismatch or invalid document fails the whole run
(nothing partial). The library files are copied into `docs/library/` (documents are the
company's own, not third-party source text; see Open items).

### Observability and audit

Audit event per: seed, edit, review, countersign, ratify, download, ingest (actor, document,
revision hash, never document body). Trace span per route; counter per gate transition.

## Delivery (one stage each, gate-checked)

1. Library files, manifest verifier, block Zod schema, `library:seed` (no DB writes yet),
   docs.
2. Tables, RLS, append-only trigger, migration + tested rollback, `tables.ts`
   classification, RBAC rows, operator-tenant config.
3. `packages/library-studio` gate rules and derived-state replay, with security tests.
4. File export (`.md/.html/.json/.docx`, workbook `.xlsx` passthrough/upload), dependency
   recorded.
5. API routes + contract tests, then the studio UI, nav and e2e.
6. Ingest route and button, Brain candidate, supersession test, `STAGE_LOG.md`.

Integration tests need Docker and are proven in CI (the authoring sandbox has none), so each
stage will say which assertions are unit-proven here and which are CI-proven.

## Decided by the operator

- Approach A (operator tenant, tenant-owned tables).
- Studio is on the operations platform, for Infinite-AI staff.
- Review, edit, file-type save, countersign, ratify, and an Ingest button into the Brain.

## My calls (please check)

- Gate order review → countersign → ratify, with distinct people (editor ≠ reviewer ≠
  countersigner; ratifier ≠ editor). The operator named only countersign and ratify.
- Editing is block-level; workbook cells are edited in Excel and re-uploaded.
- Ingest queues a Brain candidate and the Brain's own ratify step stays.
- Ingest allowed with blanks, with a visible warning and a count on the candidate.
- Roles: `platform_admin` does everything; `platform_support` is read-only.
- A countersign is an internal approval record, not a legally binding e-signature.
- Brain kind `TEMPLATE` (already exists) rather than a new kind and migration.

## Open items (go to `docs/OPEN_QUESTIONS.md`; none block stage 1)

1. **Operator tenant.** No tenant row for Infinite-AI itself is known to exist. Dev can seed
   one; production needs a human-supplied tenant id (CLAUDE.md: stop when a tenant is
   missing).
2. **Who may ratify "Needs review" documents** — a named role, or a qualified external
   reviewer recorded by name? This design records an attestation and nothing more.
3. **Where the library files live in the repo** (`docs/library/` vs a data package) and
   whether the 3.3 MB of generated binaries should be committed or fetched at seed time.
4. **Retention** for revisions and signatures (the retention schedule ships no periods;
   each is a legal decision).
5. **Library `README` mentions `npm run seed:library` and a warehouse "Library" page** that
   do not exist here; they are not reproduced.

## Left to the builder

Exact column types and indexes; filenames and route layout beyond those named; diff
rendering; the block-editor component choice within the existing design system; test
fixture layout; whether `library-studio` is its own package or lives in `packages/policy`
(preference: its own package, to keep pure rules separate).

# Document Studio and 120-document library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the 120 library documents into an operator tenant and give Infinite-AI platform staff a studio to review, edit, export, countersign, ratify and ingest them into the Brain.

**Architecture:** Block JSON is the source of truth. Pure rules (hashing, gates, status replay, export) live in a new `packages/library-studio`; tenant-owned append-only tables hold documents, revisions, signatures and ingests; Next.js routes under `/api/platform/library` and pages under `/platform/library` call them inside `withTenant`. Ingest opens an L0 Brain write candidate; the Brain's own ratify step is kept.

**Tech Stack:** TypeScript (strict), Zod 4, Prisma 7 + PostgreSQL RLS, Next.js (apps/web), Vitest, `docx` (MIT) for `.docx` only.

**Spec:** `docs/superpowers/specs/2026-11-26-document-studio-design.md` (approved 2026-11-26). Deviations from it are listed next and are for your review.

## Deviations from the approved spec (found by reading the code)

- **D1. Brain kind is a new `OPERATIONAL_DOCUMENT`, not `TEMPLATE`.** `TEMPLATE` is already the curriculum `TemplateDefinition` shape, and `selectTemplateDefinitions` (`packages/brain/src/curriculum-templates.ts`) throws on any `TEMPLATE` row that does not parse. Library documents under `TEMPLATE` would break curriculum retrieval. A new kind needs an additive enum migration (precedent: `20260828120000_brain_age_appropriateness_kind`, whose header documents why enum additions have no single-statement rollback).
- **D2. `library_revision` and `library_ingest` are append-only too**, not only `library_signature`. A signature binds a hash, so the revision it hashes must be immutable.
- **D3. Revision status is not stored.** It is derived by replaying signatures (`deriveStatus`), which removes the cache-drift risk the spec asked tests to guard.
- **D4. Signatures bind `revisionSha256`**, the hash of canonical JSON of `{content, xlsxSha256}`, not content alone, so replacing a workbook voids signatures too. The manifest's file hash is kept separately as `sourceSha256` on revision 1.
- **D5. Workbook `.xlsx` bytes are stored in the database** (`bytea`, upload cap 2 MB; the largest supplied file is 13,275 bytes), not in an object store.
- **D6. Sign-in resolves an account inside the token's tenant** (`apps/web/src/auth.ts`, `lib/token-actor.ts`) and `TenantKind` has only `SCHOOL` and `SCHOOL_GROUP`. So the operator tenant, and a `user_account` there for each platform staff member, must exist before anyone can sign. That is a human decision, recorded as OQ-055 in Task 1. Everything here is built and tested against test tenants and does not depend on it. A consequence of the spec's rules: ratifying one document needs three distinct `platform_admin` people (editor, reviewer, countersigner; the ratifier only has to differ from the editor).

## Global Constraints

- All DB access through `withTenant` (`packages/db/src/client.ts`); no `new PrismaClient()` outside `packages/db`.
- New tables classified in `packages/db/src/tables.ts` (`TENANT_OWNED_TABLES`; ledgers also in `APPEND_ONLY_TABLES`); standard RLS policy reading `current_setting('app.tenant_id', false)`; migration follows the header of `20260729160000_stage03_popia_tables` (set tenant context before the FK-validation scan).
- Every migration has a `rollback.sql` and a rollback integration test, except the enum addition in Task 7 (documented exception, see D1).
- Strict TypeScript: no `any`, no `@ts-ignore`; `unknown` plus a Zod parse. No `console.log`. No `process.env` outside `packages/config` and `apps/web/src/lib/env.ts`.
- No new dependency without a row in `docs/DEPENDENCIES.md` (name, version, licence, why, what it replaces). Only MIT/Apache-2.0/BSD/ISC.
- Rule 6: the signature row is written in the same transaction as the transition it guards; no skip flag, no env var.
- Commits: Conventional Commits, one logical change each; end each with the attribution trailers the session specifies. PR ≤ ~400 changed lines excluding generated files, lockfiles and the library data in `docs/library/`.
- Integration tests need Docker and are CI-proven; each task states which assertions are unit-proven locally.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and the touched packages' tests pass before each commit. Update the relevant `docs/` file in the same commit.
- Stage numbers continue from 143: Task N is Stage 143+N, logged in `docs/STAGE_LOG.md`.

## Review Focus

- **Hostile text in a block** (`<script>`, `|`, newlines, backticks): `.html` export escapes all text; `.md` table cells cannot break out of their row. Tested in Task 3.
- **Two editors save at once:** the second request, which names a stale `parentRevisionId`, gets a conflict (409) and no revision is lost. Tested in Tasks 4 and 6.
- **Signing a stale revision:** a client holding an older hash cannot sign or ingest the current one; the hash in the body must equal the current revision's. Tested in Tasks 6 and 7.
- **A bad "xlsx" upload** (not a zip, macro-enabled, over 2 MB, wrong extension) is refused with a reason and creates no revision. Tested in Task 6.
- **Re-running the seed after staff edits** changes nothing for an edited document. Tested in Task 5.

---

### Task 1: Contracts, library data, manifest check (Stage 144)

**Files:**

- Create: `packages/contracts/src/library/blocks.ts`, `manifest.ts`, `api.ts`, `index.ts`
- Modify: `packages/contracts/src/index.ts` (export `./library/index.js`), `.prettierignore` (add `docs/library/`: generated content that `prettier --check` would otherwise fail on)
- Create: `docs/library/**` (the unzipped `library/` folder, byte-for-byte: 120 documents, `manifest.json`, `README.md`), `docs/library/SOURCE.md` (where it came from, "do not edit; the studio holds edits")
- Modify: `docs/OPEN_QUESTIONS.md` (add OQ-055 operator tenant and staff accounts, from D6; OQ-056 who may ratify "Needs review" documents; OQ-057 retention of revisions and signatures)
- Test: `packages/contracts/test/library-corpus.spec.ts`, `library-api.spec.ts`

**Interfaces:**

- Produces (all Zod schemas plus inferred types, exported from `@infinite-ai/contracts`):
  - `LibraryBlock`: discriminated union on `type`: `h{level:2|3,text}`, `p{text}`, `ul{items:string[]}`, `ol{items:string[]}`, `kv{pairs:[string,string][]}`, `table{headers:string[],rows:string[][]}`, `callout{tone:'warn',text}`, `checklist{checks:{label:string,done:boolean}[]}`. Shapes are those in the supplied corpus.
  - `LibraryDocumentContent`: `{title:string, subtitle?:string, meta:Record<string,string>, blocks:LibraryBlock[]}`.
  - `LibraryManifest`: `{count:number, items: LibraryManifestItem[]}`; item: `{id:/^lib-[a-z0-9-]+$/, title, group, dept, kind, review:string|null, law:string[], files:{ext:'html'|'md'|'json'|'docx'|'xlsx', path:string, sha256:/^[0-9a-f]{64}$/, bytes:number}[]}`.
  - `LibrarySignatureKind = 'REVIEW'|'COUNTERSIGN'|'RATIFY'`; `LibraryRevisionStatus = 'DRAFT'|'REVIEWED'|'COUNTERSIGNED'|'RATIFIED'`; `LibraryFileFormat = 'docx'|'xlsx'|'html'|'md'|'json'`.
  - Request bodies: `LibraryListQuery{dept?,group?,kind?,status?,q?}`; `EditRevisionBody{parentRevisionId:guid, content, reason:trimmed non-empty}`; `SignBody{kind, revisionId:guid, revisionSha256:hex64, reason:trimmed non-empty, attestation?:{name,role,scope}}`; `IngestBody{revisionId:guid, revisionSha256:hex64}`.
  - Response: `LibraryDocumentSummary` and `LibraryDocumentDetail` (document, revisions, signatures, `status`, `allowedActions:{edit,review,countersign,ratify,ingest}` each `{allowed:true}|{allowed:false,refusal:string}`).

- [ ] **Step 1: Write the failing tests.** `library-corpus.spec.ts` reads every `docs/library/*/lib-*.json`: `it('parses all 120 documents against LibraryDocumentContent')` asserts 120 parse and none fail; `it('manifest lists 120 items and every file hash matches the file on disk')` asserts `LibraryManifest.parse(...)` and `sha256(fileBytes) === item.sha256` for all 504 files; `it('every manifest id has a json file and a docx file')`. `library-api.spec.ts`: `SignBody` rejects a non-hex hash, an empty reason, an unknown kind; `EditRevisionBody` rejects a block with an unknown `type`; `LibraryDocumentDetail` accepts a fixture with `allowedActions`.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/contracts test library` → FAIL (modules and data missing).
- [ ] **Step 3: Copy the library** from the upload into `docs/library/` unchanged; add the schemas; export them; add `docs/library/` to `.prettierignore`; write the three OQ entries (each states the question, why it blocks, and what is built meanwhile).
- [ ] **Step 4: Run** the same command → PASS; then `pnpm format:check` and `pnpm lint` → exit 0.
- [ ] **Step 5: Commit** `feat(library): contracts, library data and manifest check`.

### Task 2: Pure rules package (Stage 145)

**Files:**

- Create: `packages/library-studio/{package.json,tsconfig.json}` (copy `packages/document-annotation`'s shape; depends on `@infinite-ai/contracts`, `@infinite-ai/policy`), `src/{hash.ts,blanks.ts,gates.ts,diff.ts,load.ts,index.ts}`, `README.md`
- Modify: root `tsconfig.json` references if other packages are listed there
- Test: `packages/library-studio/test/{hash,blanks,gates,diff,load}.spec.ts`

**Interfaces:**

- Consumes: `LibraryDocumentContent`, `LibraryBlock`, `LibrarySignatureKind`, `LibraryRevisionStatus`, `LibraryManifest` (Task 1); `Role` from `@infinite-ai/policy`.
- Produces:
  - `canonicalJson(value: unknown): string` (keys sorted recursively, no whitespace); `sha256Hex(bytes: Uint8Array): string`; `revisionSha256(content: LibraryDocumentContent, xlsxSha256: string | null): string` (sha256 of `canonicalJson({content, xlsxSha256})`).
  - `countUnfilledBlanks(content: LibraryDocumentContent): number` (matches `/\[Fill in:[^\]]*\]/g` in every string leaf, including `meta`).
  - `interface SignatureFact { kind: LibrarySignatureKind; signerActorId: string; revisionSha256: string; signedAt: Date }`; `interface RevisionFacts { revisionSha256: string; editedBy: string | null; signatures: readonly SignatureFact[] }`.
  - `deriveStatus(f: RevisionFacts): LibraryRevisionStatus` (ignores signatures whose hash differs; REVIEWED needs REVIEW; COUNTERSIGNED needs REVIEW then COUNTERSIGN; RATIFIED needs all three in that order by `signedAt`).
  - `type GateRefusal = 'ROLE_NOT_PERMITTED'|'ALREADY_SIGNED'|'PREREQUISITE_MISSING'|'SIGNER_IS_EDITOR'|'SIGNER_ALREADY_SIGNED_EARLIER_GATE'|'NOT_RATIFIED'`; `type GateDecision = {allowed:true}|{allowed:false; refusal: GateRefusal}`.
  - `checkSign(f: RevisionFacts, kind: LibrarySignatureKind, signer: {actorId: string; role: Role}): GateDecision`; `checkEdit(role: Role): GateDecision`; `checkIngest(f: RevisionFacts, role: Role): GateDecision`.
  - `diffBlocks(a: readonly LibraryBlock[], b: readonly LibraryBlock[]): {index:number; change:'added'|'removed'|'changed'}[]`.
  - `loadLibrary(root: string, readFile: (path: string) => Promise<Uint8Array>): Promise<LoadedDocument[]>` where `LoadedDocument = {id, title, group, dept, kind, reviewBy: string|null, law: string[], content: LibraryDocumentContent, sourceSha256: string, xlsx: {bytes: Uint8Array; sha256: string} | null}`. Verifies every manifest hash; throws `LibraryLoadError` naming the file on any mismatch or parse failure; returns nothing partial.

- [ ] **Step 1: Write the failing tests.** Gates (table-driven): `platform_support` → every `checkSign` is `ROLE_NOT_PERMITTED`; editor signing REVIEW → `SIGNER_IS_EDITOR`; COUNTERSIGN without REVIEW → `PREREQUISITE_MISSING`; countersigner equal to reviewer → `SIGNER_ALREADY_SIGNED_EARLIER_GATE`; RATIFY without COUNTERSIGN → `PREREQUISITE_MISSING`; ratifier equal to editor → `SIGNER_IS_EDITOR`; ratifier equal to reviewer → allowed; second REVIEW on the same hash → `ALREADY_SIGNED`; `editedBy: null` blocks nobody; `checkIngest` on `COUNTERSIGNED` → `NOT_RATIFIED`. `deriveStatus`: signatures for a different hash yield `DRAFT`; the full valid chain yields `RATIFIED`; a COUNTERSIGN dated before REVIEW does not count. Hash: key order does not change `canonicalJson`; changing `xlsxSha256` changes `revisionSha256`. Blanks: `countUnfilledBlanks` over the NDA fixture equals the number of `[Fill in:` occurrences in its JSON text. Load: a flipped byte in an injected file throws `LibraryLoadError` naming that path and returns no partial result; the real `docs/library` loads 120 documents, 22 with `xlsx`.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/library-studio test` → FAIL.
- [ ] **Step 3: Implement** the signatures above. `deriveStatus` and `checkSign` share one internal "valid chain" helper so they cannot disagree.
- [ ] **Step 4: Run** the tests and `pnpm --filter @infinite-ai/library-studio test:coverage` (thresholds per §4.2 must hold) → PASS; `pnpm typecheck`, `pnpm lint` → exit 0.
- [ ] **Step 5: Commit** `feat(library): pure gate, hash and load rules`.

### Task 3: File export (Stage 146)

**Files:**

- Create: `packages/library-studio/src/export.ts`; modify `package.json` (add `docx`), `index.ts`
- Modify: `docs/DEPENDENCIES.md` (row for `docx`: record the exact version and licence verified with `pnpm view docx version license` when adding)
- Test: `packages/library-studio/test/export.spec.ts`

**Interfaces:**

- Consumes: `LibraryDocumentContent`, `LibraryFileFormat`, `revisionSha256` (Tasks 1–2).
- Produces: `interface ExportMeta { libraryId: string; revisionNo: number; revisionSha256: string; status: LibraryRevisionStatus; xlsx: Uint8Array | null }`; `renderFile(format: LibraryFileFormat, content: LibraryDocumentContent, meta: ExportMeta): Promise<{ bytes: Uint8Array; mime: string; filename: string }>`. Filename is `<libraryId>-r<revisionNo>-<first 8 hex of hash>.<ext>`. `xlsx` returns `meta.xlsx` unchanged and throws `ExportError` when there is none. `md`, `html` and `docx` start with the line `UNRATIFIED DRAFT, revision N, not approved for use` unless `status === 'RATIFIED'`. `json` is `canonicalJson` pretty-printed and equals the stored content.

- [ ] **Step 1: Write the failing tests.** `html` of a paragraph `<script>alert(1)</script>` contains `&lt;script&gt;` and no raw `<script`; `md` of a table cell `a|b\nc` stays on one row with the pipe escaped; every block type renders in `md`, `html` and `docx` (docx output starts with the `PK` zip signature and, unzipped, contains the heading text); unratified banner present for `DRAFT` and absent for `RATIFIED`; `xlsx` format returns the same bytes as the input and throws `ExportError` for `null`; `json` round-trips through `LibraryDocumentContent.parse` to deep-equal the input; filename matches `/^lib-nda-r2-[0-9a-f]{8}\.docx$/`.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/library-studio test export` → FAIL.
- [ ] **Step 3: Implement** `renderFile`. Markdown and HTML are hand-written string builders over the block union (escape in one helper per format); only `docx` uses the library.
- [ ] **Step 4: Run** tests, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` → PASS. Also run `pnpm exec tsx scripts/audit-supply-chain.ts` and confirm it passes with the new dependency.
- [ ] **Step 5: Commit** `feat(library): export to docx, html, md, json and xlsx passthrough`.

### Task 4: Tables, RLS, accessors (Stage 147)

**Files:**

- Modify: `packages/db/prisma/schema.prisma` (models and enum below), `packages/db/src/tables.ts`, `packages/db/src/index.ts`
- Create: `packages/db/prisma/migrations/20261126100000_library_studio_tables/{migration.sql,rollback.sql}`, `20261126100100_library_studio_rls/{migration.sql,rollback.sql}`, `packages/db/src/library.ts`
- Test: `packages/db/test/library.spec.ts` (unit), `library.integration.spec.ts`, `library-rollback.integration.spec.ts`; the existing `rls-coverage`, `rls-exhaustive` and `schema-classification` suites pick the tables up from `tables.ts`
- Modify: `docs/POPIA.md` only if retention wording is touched (it is not); `packages/db/README.md` (table list)

**Interfaces:**

- Produces schema: enum `LibrarySignatureKind {REVIEW COUNTERSIGN RATIFY}` (`@@map("library_signature_kind")`); models `LibraryDocument` (`libraryId` unique per tenant, `title`, `group`, `dept`, `kind`, `reviewBy String?`, `law String[]`, `currentRevisionId String? @db.Uuid`), `LibraryRevision` (`documentId`, `revisionNo`, `parentRevisionId?`, `content Json`, `revisionSha256`, `sourceSha256?`, `editedBy? @db.Uuid`, `editReason?`, `xlsxBytes Bytes?`, `xlsxSha256?`, `createdAt`; unique `[documentId, revisionNo]`), `LibrarySignature` (`revisionId`, `revisionSha256`, `kind`, `signerActorId @db.Uuid`, `reason`, `attestation Json?`, `signedAt`; unique `[revisionId, kind]`), `LibraryIngest` (`revisionId` unique, `revisionSha256`, `brainWriteCandidateId @db.Uuid`, `actorId`, `unfilledBlanks Int`, `createdAt`). All carry `tenantId` with the standard relation and `onDelete: Cascade` pattern used by `ConsentRecord`.
- Produces `packages/db/src/library.ts` (all take `tx: TenantClient`): `seedLibraryDocument(tx, doc: SeedLibraryDocument): Promise<'created'|'unchanged'>` (no-op when the `libraryId` exists); `listLibraryDocuments(tx, q: LibraryListQuery): Promise<LibraryDocumentRow[]>`; `getLibraryDocumentWithHistory(tx, libraryId): Promise<LibraryDocumentHistory | null>` (document, all revisions ascending without `xlsxBytes`, all signatures); `getRevisionXlsx(tx, revisionId): Promise<Uint8Array | null>`; `insertRevision(tx, input: {documentId, parentRevisionId, content, xlsx: {bytes, sha256} | null, editedBy, editReason}): Promise<LibraryRevisionRow>` (inside one transaction: lock the document row, require `currentRevisionId === parentRevisionId` else throw `LibraryConflictError`, insert `revisionNo + 1`, move the pointer); `insertSignature(tx, input): Promise<LibrarySignatureRow>`; `insertIngest(tx, input): Promise<LibraryIngestRow>`; `class LibraryConflictError extends Error`.
- Tables added to `TENANT_OWNED_TABLES`; `library_revision`, `library_signature`, `library_ingest` also to `APPEND_ONLY_TABLES` (D2), with the trigger in the migration; `library_document` is mutable (pointer only).

- [ ] **Step 1: Write the failing tests.** Unit (`library.spec.ts`): `LibraryConflictError` is exported; export surface lists the new accessors (extend `export-surface.spec.ts`'s expectation). Integration: another tenant's `withTenant` reads zero library rows; a query with no tenant context errors; `UPDATE`/`DELETE` on `library_revision`, `library_signature` and `library_ingest` is refused by trigger while `library_document.current_revision_id` updates succeed; `insertRevision` with a stale `parentRevisionId` throws `LibraryConflictError`, and two concurrent calls with the same parent produce exactly one new revision; unique `[revisionId, kind]` refuses a second REVIEW; `seedLibraryDocument` twice yields `'created'` then `'unchanged'` and one row. Rollback spec: apply `rollback.sql` for both migrations and assert the tables, enum and policies are gone (pattern: `role-grant-request-rollback.integration.spec.ts`).
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/db test` → FAIL; `schema-classification` fails on the unclassified tables once the schema is edited (expected until Step 3).
- [ ] **Step 3: Implement** schema, migrations (FK-scan tenant-context header as in the stage-03 migration), rollbacks, `tables.ts`, accessors; run `pnpm --filter @infinite-ai/db db:generate`.
- [ ] **Step 4: Run** `pnpm --filter @infinite-ai/db test` (unit, PASS locally) and `pnpm typecheck`, `pnpm lint`. The integration specs are written blind here and **proven in CI**; say so in the PR body.
- [ ] **Step 5: Commit** `feat(db): library studio tables with RLS and append-only ledgers`.

### Task 5: Seed script (Stage 148)

**Files:**

- Create: `scripts/seed-library.ts`; modify root `package.json` (`"library:seed": "tsx scripts/seed-library.ts"`), `packages/config/src/env.ts` (add `OPERATOR_TENANT_ID: z.string().uuid().optional()`), `docs/OPERATOR_MANUAL.md` (how to run the seed and what it refuses)
- Test: `packages/db/test/library-seed.integration.spec.ts` (CI-proven); `scripts/` has no unit tier, so the logic stays in `loadLibrary` (Task 2, unit-proven) and `seedLibraryDocument` (Task 4)

**Interfaces:**

- Consumes: `loadLibrary` (Task 2), `seedLibraryDocument`, `withTenant` (Task 4), `loadEnv` from `@infinite-ai/config`.
- Produces: CLI `pnpm library:seed [--root docs/library]`. Refuses with a one-line reason and exit 1 when `OPERATOR_TENANT_ID` is unset or the tenant row does not exist; loads and verifies all 120 before writing any; runs the repo's PII detector (find the exported detector in `packages/deident` or `packages/guardrails` by grep) over every block text and aborts, naming the document, on any hit; writes inside one `withTenant` transaction; prints `created N, unchanged M`; second run prints `created 0, unchanged 120`.

- [ ] **Step 1: Write the failing integration test.** Seed into a fresh test tenant: 120 documents, 120 revisions numbered 1, 22 with `xlsxBytes`, each revision's `sourceSha256` equals the manifest's json hash; second run creates nothing; after `insertRevision` edits one document, a re-seed leaves that document's revision 2 and its pointer untouched (Review Focus); a deliberately corrupted file in a temp copy of the library aborts with zero rows written; a temp copy with one block containing a South African ID-number-shaped string aborts naming that document, with zero rows written.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/db test:integration library-seed` (CI) → FAIL.
- [ ] **Step 3: Implement** the script as a thin shell over the two functions above; add the env key and document it in `.env.example` by name only (empty value, rule 7).
- [ ] **Step 4: Run** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`; run `OPERATOR_TENANT_ID= pnpm library:seed` and confirm the refusal message and exit code 1 locally.
- [ ] **Step 5: Commit** `feat(library): idempotent seed of the 120 documents`.

### Task 6: Routes, RBAC, access (Stage 149)

**Files:**

- Create: `apps/web/src/lib/library-route.ts` (shared guard), `apps/web/src/app/api/platform/library/route.ts` (GET list), `[id]/route.ts` (GET detail), `[id]/revisions/route.ts` (POST edit), `[id]/sign/route.ts` (POST), `[id]/file/route.ts` (GET), `[id]/xlsx/route.ts` (POST upload)
- Modify: `packages/policy/src/rbac.ts` (resource `library_document`: `platform_support` read; `platform_admin` read, update, approve, export; scope `PLATFORM`), `apps/web/src/lib/route-access.ts` (`/api/platform/library` and `/platform/library` → platform roles), `apps/web/src/lib/env.ts` (optional `OPERATOR_TENANT_ID`, in all three env blocks), `docs/OPERATOR_MANUAL.md`
- Test: `apps/web/tests/unit/library-routes.spec.ts`, `library-route-access.spec.ts`, `packages/policy/test/rbac-library.spec.ts`; contract assertions against Task 1 schemas

**Interfaces:**

- Consumes: Task 1 schemas, Task 2 `checkSign`/`checkEdit`/`deriveStatus`/`revisionSha256`/`renderFile` (Task 3), Task 4 accessors, `getToken`, `readTokenActor`, `appendAuditEvent`.
- Produces: `guardLibraryRequest(request): Promise<{ok:true; actor:{tenantId,actorId}; role:Role} | {ok:false; response: NextResponse}>`: 401/403 from `readTokenActor`; 403 unless role is `platform_admin` or `platform_support`; 503 `operator tenant not configured` when `OPERATOR_TENANT_ID` is unset in production; 403 when the token's tenant is not the operator tenant. Handlers return `LibraryDocumentDetail` (with server-computed `allowedActions`) and use the shapes in Task 1. Mutations require `platform_admin`. Each mutation writes one `appendAuditEvent` (actor, library id, revision hash, never the body); every handler emits a trace span and every gate transition increments a counter through `packages/telemetry` (follow how an existing route or worker step does it; a unit test asserts the span name and counter label for sign). Sign: validates `SignBody`; refuses 409 when `revisionSha256` or `revisionId` is not the document's current revision; `REVIEW` on a document with `reviewBy !== null` requires `attestation` else 422; calls `checkSign` and maps refusals to 403/409; inserts the signature in the same transaction. Upload: accepts only `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` bytes up to 2 MB, which begin with `PK`, contain `[Content_Types].xml` and no `vbaProject.bin`; creates a new revision (same content, new `xlsxSha256`).

- [ ] **Step 1: Write the failing tests.** Access: `platform_support` POSTs → 403 on every mutation, GET → 200; a school `admin` → 403 everywhere; a platform token whose tenant is not the operator tenant → 403; production with no `OPERATOR_TENANT_ID` → 503. Edit: stale `parentRevisionId` → 409 and no new revision; missing `reason` → 400. Sign: stale hash → 409; editor signing REVIEW → 403 with `SIGNER_IS_EDITOR`; `REVIEW` without attestation on a `reviewBy` document → 422; a valid chain REVIEW → COUNTERSIGN → RATIFY by three different actors ends `RATIFIED` and writes three audit events; the signature exists before the response returns. Upload: a text file renamed `.xlsx`, a zip containing `vbaProject.bin`, and a 2 MB + 1 byte file each → 4xx and zero new revisions; a real supplied workbook → 201 and a new revision whose hash differs. File: `?format=docx` returns the `PK` signature; `?format=xlsx` on a non-workbook → 404. RBAC spec: matrix grants exactly the rows above; `learner`, `guardian` and school roles have none. `route-access` table test lists the new prefixes and `/platform/librarian` matches nothing.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/web test library` and `pnpm --filter @infinite-ai/policy test rbac-library` → FAIL.
- [ ] **Step 3: Implement** guard, handlers and rows. Handlers stay thin: parse with Zod, `withTenant`, call accessors and pure rules, audit, respond. Route unit tests inject fakes the way `apps/web/tests/unit/route-access.spec.ts` and the caps-canon route specs do.
- [ ] **Step 4: Run** the three commands above plus `pnpm typecheck`, `pnpm lint`, `pnpm format:check` → PASS.
- [ ] **Step 5: Commit** `feat(web): library studio API with signature gates`.

### Task 7: Brain ingest (Stage 150)

**Files:**

- Modify: `packages/brain/src/write-path-schemas.ts` (add `'OPERATIONAL_DOCUMENT'` to `BrainConstitutionKind`), `packages/db/prisma/schema.prisma` (enum), `packages/brain/src/index.ts`; create `packages/db/prisma/migrations/20261126110000_brain_operational_document_kind/migration.sql` (additive `ALTER TYPE ... ADD VALUE`, header copied in spirit from the age-appropriateness one, citing D1 and the rollback exception), `packages/brain/src/library-documents.ts`, `apps/web/src/app/api/platform/library/[id]/ingest/route.ts`
- Test: `packages/brain/test/library-documents.spec.ts`, `apps/web/tests/unit/library-ingest-route.spec.ts`, `packages/db/test/library-ingest.integration.spec.ts` (CI-proven)
- Modify: `docs/ARCHITECTURE.md` or `docs/POPIA.md` only if the kind list is enumerated there (grep first); `docs/OPERATOR_MANUAL.md`

**Interfaces:**

- Consumes: `remember` (`packages/brain/src/api.ts`), `insertIngest` (Task 4), `deriveStatus`/`checkIngest`/`countUnfilledBlanks` (Task 2), guard (Task 6).
- Produces: `submitLibraryDocument(tx: TenantClient, input: {libraryId: string; revisionNo: number; revisionSha256: string; content: LibraryDocumentContent; unfilledBlanks: number}, source: string, now?: Date): Promise<BrainWriteCandidateRow>` which calls `remember` with `targetTier: 'L0_CONSTITUTION'`, `rawPayload: {key: libraryId, kind: 'OPERATIONAL_DOCUMENT', content: {libraryId, revisionNo, revisionSha256, unfilledBlanks, document: content}}`, `source: 'library:<libraryId>:<revisionNo>'`. It never ratifies. Route `POST /api/platform/library/[id]/ingest` (`IngestBody`): `platform_admin` only; refuses 409 when the body hash is not the current revision's, 403 with `NOT_RATIFIED` unless `checkIngest` allows; idempotent per revision (second call returns the existing candidate with `alreadyIngested: true`); writes the candidate, the `library_ingest` row and an audit event in one transaction.

- [ ] **Step 1: Write the failing tests.** Brain: `submitLibraryDocument` leaves the candidate `AWAITING_RATIFICATION` and its payload carries `unfilledBlanks`; `BrainConstitutionKind.parse('OPERATIONAL_DOCUMENT')` succeeds; `selectTemplateDefinitions` still ignores `OPERATIONAL_DOCUMENT` rows and does not throw (the D1 regression). Route: unratified revision → 403 `NOT_RATIFIED` and no candidate; stale hash → 409; ratified current revision → 200 with a candidate id and one `library_ingest` row; second press → 200 `alreadyIngested: true`, no second candidate; `platform_support` → 403. Integration (CI): ingest r1, ratify the candidate through the existing Brain flow, edit and ratify r2, ingest r2: r1's constitution row remains readable and unmodified (follow `brain-write-path.integration.spec.ts` for the supersession expectation).
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/brain test library` and `pnpm --filter @infinite-ai/web test library-ingest` → FAIL.
- [ ] **Step 3: Implement** the enum member, migration, wrapper and route. Before adding the kind, grep `packages/brain/src` and `packages/guardrails/src` for exhaustive switches over `BrainConstitutionKind` and update any that fail typecheck.
- [ ] **Step 4: Run** the commands above, `pnpm typecheck`, `pnpm lint` → PASS; `pnpm --filter @infinite-ai/db db:generate` regenerates the client.
- [ ] **Step 5: Commit** `feat(brain): ingest ratified library documents as OPERATIONAL_DOCUMENT`.

### Task 8: Studio UI (Stage 151)

**Files:**

- Create: `apps/web/src/app/(shell)/platform/library/page.tsx`, `apps/web/src/app/(shell)/platform/library/[id]/page.tsx`, `apps/web/src/components/platform/library/{LibraryList.tsx,LibraryDocumentView.tsx,BlockEditor.tsx,block-editor-state.ts,SignaturePanel.tsx,FileDownload.tsx,IngestButton.tsx}`
- Modify: `apps/web/src/lib/roles.ts` (nav entry "Document Studio" → `/platform/library` for `platform_support` and `platform_admin`)
- Test: `apps/web/tests/unit/library-ui.spec.ts`, `block-editor-state.spec.ts`; `apps/web/tests/e2e/library.spec.ts` (CI-proven)

**Interfaces:**

- Consumes: Task 6/7 routes and `LibraryDocumentDetail.allowedActions`; `diffBlocks` (Task 2); existing design-system components (`packages/design-system`).
- Produces: `editBlocksReducer(state: {blocks: LibraryBlock[]; dirty: boolean}, action: {type:'setText'|'setCell'|'setItem'|'toggleCheck'; ...}): state` (pure, unit-tested, never changes a block's `type`); pages gated by session role exactly as `platform/runs/page.tsx` does. The UI renders buttons only from `allowedActions` (it holds no gate logic of its own); each disabled action shows the server's `refusal` text; **Ingest** shows `unfilledBlanks` and asks for confirmation when it is above zero; workbook documents show the "edit cells in Excel and upload" note and an `.xlsx` upload control; the file picker lists only formats valid for that document; the revision history lists each revision with a `diffBlocks` summary against its parent.

- [ ] **Step 1: Write the failing tests.** Reducer: editing a cell changes only that cell and sets `dirty`; an action naming an out-of-range index is a no-op; no action can change `type`. UI: with `allowedActions.ratify = {allowed:false, refusal:'PREREQUISITE_MISSING'}` the Ratify button is disabled and shows the reason; `platform_support` sees no edit or gate buttons; the file list for a non-workbook excludes `xlsx`; Ingest on a document with 3 blanks shows the confirmation text containing "3". Page: no session → redirect `/sign-in`; wrong role → redirect `/`. E2E (CI): seed three platform admins, edit → review → countersign → ratify → ingest through the browser and see the status chips change.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/web test library-ui block-editor-state` → FAIL.
- [ ] **Step 3: Implement** the components with server components fetching through the same accessors the routes use; client components only for the editor, panel and buttons. Keyboard-operable controls and visible labels (the web app has an a11y suite, `pnpm test:a11y`).
- [ ] **Step 4: Run** unit tests, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm --filter @infinite-ai/web build` → PASS; run `pnpm test:a11y` if a browser is available here, otherwise note it as CI-proven.
- [ ] **Step 5: Commit** `feat(web): document studio pages and controls`.

### Task 9: Stage gate and log (Stage 152)

**Files:**

- Modify: `scripts/verify-stage.ts` (register stages 144–152 the way stage 143 is registered; read the file and follow its pattern), `docs/STAGE_LOG.md` (one entry per stage: what changed, tests, which assertions are CI-proven, Exit Gate table, known gaps stated plainly), `CHANGELOG.md`, `docs/OPEN_QUESTIONS.md` (link OQ-055..057 to the log)
- Test: `pnpm verify:stage 152`

**Interfaces:** Consumes everything above; produces nothing new.

- [ ] **Step 1: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build` → all exit 0; record any failure and fix its root cause (never skip a test).
- [ ] **Step 2: Walk the spec's seven goals** against `docs/STAGE_LOG.md`, naming the test that proves each, and listing honestly what is only CI-proven (all integration specs, the e2e run).
- [ ] **Step 3: Run** `pnpm verify:stage 152` → exit 0.
- [ ] **Step 4: Commit** `docs(library): stage log and gate for the document studio`.

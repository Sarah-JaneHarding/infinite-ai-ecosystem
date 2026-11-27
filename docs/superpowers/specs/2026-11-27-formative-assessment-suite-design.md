# Formative assessment suite (cards, quizzes, capture, monitoring) — design

**Status: DRAFT for the owner's approval. Nothing is built.** Written 2026-11-27 after a scoping conversation. Where a point is
the owner's decision it says so; where it is my call it is marked **(my call)** so it can be overruled.

## 1. Intent

Give a South African primary-school teacher low-tech and low-friction ways to see, before, during and after a lesson, who has understood
what, and act on it quickly. The model is a combination of two products the owner named: Plickers (learners answer by holding up a
printed card; the teacher's phone scans the room) and Kahoot! (a game-like quiz with timer, points, streaks, leaderboard and podium).
BookWidgets-style teacher-built interactive exercises are the wider toolbox these sit in. A generative assistant drafts quizzes and
other content quickly. Agents can pass work to each other, but only as **proposals a human has approved**.

Why: the platform has the safety and tenancy plane but no teacher journey that produces or collects anything yet
(`docs/FEATURE_MATRIX.md` §4). Formative data collected by the teacher in the classroom is the missing input for the Support Analytics
Centre (MOD-02) and the PD Studio (MOD-05).

## 2. What exists today (verified by reading the repository)

- `packages/low-tech-assessment`: pure logic only. `MAX_CARDS = 40`, codes `LTA-NN`, sides A–D, `Question` (2–4 options), session
  lifecycle, tallies, `unscannedCards()`. No camera, database, artwork or persistence.
- 80 static HTML widgets in `apps/web/public/widgets/` (TB-W14 to TB-W20 are a classroom kit). No web page links to them.
- MOD-04 pipeline `draft → teacher approval (human gate) → deliver → capture edit signal`. **No web route starts a run** (task T05).
- `/assistant` chat panel: staff only, text scrubbed by `packages/deident`, strict request schema, audit event without text.
- No class-list import; no learner roster ingest; no object storage for teacher files; no vision input in the gateway.
- Declared purposes include `planning`, `screening`, `intervention`, `pd_analytics`; none names formative classroom assessment.
- Agent tool allow-lists are closed (`packages/security/src/agent-surface.ts`); no agent can call another.

## 3. Goals

1. **Plickers-style cards.** 100 printable cards, bold and simple so a phone camera reads them reliably. Four sides = A, B, C, D.
2. **Scanning screen.** Each learner's name flashes on the teacher's phone as the card is read; a "not yet scanned" strip shows who is
   missing; re-scan, mark absent, and undo.
3. **Assign in advance, to many classes.** A specialist teacher sets up sessions for all their classes ahead of time.
4. **Class lists** from a file the teacher uploads (CSV, Excel, Word tables, text PDF) or from the school's other systems where an
   export or credentialed integration exists.
5. **Kahoot-style quizzes** drafted by an agent from a prompt, approved by the teacher, then run live: timer, speed points, streaks,
   leaderboard, podium, colourful tiles, sound. Question types that learners can answer with a card: multiple choice, true/false, poll.
6. **Attachments.** A teacher can attach files or whole folders, in any format, to a class, session or question, for reference or to
   embed in a quiz or on the board.
7. **Photo assessment.** Teacher photographs written work; marks it against an answer memo or a pre-generated rubric; raw marks are
   captured per question; the agent drafts individual feedback for the teacher to review.
8. **Video poll tool.** Teacher records a short video; the phone counts thumbs up/down and raised hands and fills in a graph that can
   be scanned back with the phone.
9. **Constant monitoring.** Collected data is analysed continuously; quick alerts and draft support resources are produced for the
   teacher (and, for SBST-relevant patterns, as de-identified signals).
10. **Agent handoff.** An agent can hand a proposal to another agent; it moves only after the responsible teacher approves it.

## 4. Non-goals and anti-goals

Non-goals: learner devices or learner log-ins (off for the pilot); copying Kahoot! or Plickers branding, artwork or code; LMS publishing
(stubbed today); cross-school learner data; screening-tier recommendations (removed, R01).

Anti-goals (a failure even if it technically works): a learner's name, photo, video or handwriting reaching a model prompt; names on a
shared screen by default; an approval that can be bypassed; a second route to a model provider; a cross-tenant read of identifiable data;
the assistant presenting an alert as a diagnosis.

## 5. Constraints (from `CLAUDE.md`, not negotiable here)

Rules 1–11 apply. Those most in play: rule 4 (no learner PII in a prompt), rule 5 (tenant-scoped client; every new table classified in
`packages/db/src/tables.ts` and covered by the RLS suite), rule 6 (human gates), rule 3 (gateway only), rule 9 (every new dependency
recorded), rule 10 (forward migration plus tested rollback). Definition of Done applies per task: strict TypeScript, happy path plus two
failure paths, a security test where tenancy/PII/guardrails are touched, a Zod contract plus contract test for each API surface, docs in
the same commit. Each stage ends with `pnpm verify:stage`. PRs stay near 400 changed lines, so this is many PRs.

## 6. Owner decisions (as stated)

- Agents may capture learner data and work with it inside the signed-in environment. Only the signed-in person using the widget sees
  learner-identifying information.
- Cards are simple, as Plickers' are. A name flashes on each scan. The "not captured" list is shown.
- The agent creates colourful Kahoot-style quizzes from prompts. Combine the features of both products.
- **Board names: option B.** Names may be shown on the shared board through a teacher-controlled switch.
- Teachers can attach folders or files in any format for reference or to embed.

## 7. Approaches considered

1. **Vertical slices, one stage at a time (chosen as recommended; owner proceeded on it).** Each tool is its own stage with its own exit
   gate. Stage-1 tables already carry the proposal and audit fields later stages need. Trade-off: slow to show everything.
2. Platform first (data tools, handoff bus, then tools). Cleaner, but no teacher-usable output for a long time.
3. Standalone offline widgets like the existing 80. Fast, but cannot support multi-class assignment, monitoring or alerts.

## 8. Design

### 8.1 Data and who sees names

- Results are stored against **card number** (a pseudonym), never against a name. The class-set table maps card number → learner and is
  tenant-scoped, readable only through the signed-in teacher assigned to that class (specialist teachers: their classes only).
- Agents reach learner data only through new **tenant-scoped tools** that act as the signed-in teacher, check purpose and lawful basis
  (`packages/policy/src/access.ts` order), and write an audit event. Tools return pseudonymous tokens; the browser restores names for the
  signed-in teacher. This is how "agents may work with learner data" is delivered without PII in a prompt.
- Existing tables are reused, not duplicated: `Learner`, `ClassGroup` and `StaffMember` (`packages/db/prisma/schema.prisma`). New
  tables hold the card assignment (class set × card number → learner), sessions, scans and proposals. A learner can hold a different
  card number in each class set, so a specialist teacher's classes never collide. Every new table is classified in `tables.ts`.
- **(my call)** Other roles (HoD, SMT, SBST) see de-identified aggregates only until a separate approved flow says otherwise.
- **(my call)** A new purpose, working name `formative_assessment` (categories ENROLMENT, ACADEMIC_PERFORMANCE; re-identification
  permitted for display; model processing permitted on de-identified data only). Needs the school's POPIA officer to confirm the name and
  any category for photos and video (see §10).

### 8.2 Cards

- 5×5 grid of large cells, black on white, thick quiet border, one fixed orientation cue; rotating the card to each of four sides reads
  as A–D. 100 patterns chosen so every card and every rotation is at least a minimum Hamming distance from every other (the builder
  proves the distance by test). The number is printed large on the back. Original pattern; no Plickers artwork.
- `MAX_CARDS` rises from 40 to 100; the schema, `generateCardSet`, tests and README change with it. A printable PDF set is generated
  from the same codes. Decoder runs in the phone browser (no upload of camera frames) and is tested against simulated blur, glare, tilt
  and a covered corner.
- Cost of a wrong read is a wrong mark, so the scanner shows a confidence state and never silently guesses: low confidence prompts a
  re-scan.

### 8.3 Scan screen and board

- **Teacher phone:** the name flashes briefly on each accepted scan; a persistent strip lists cards not yet scanned; actions: re-scan,
  mark absent, undo. The name list is held in memory for the session and cleared at sign-out. **(my call)** Offline use keeps scans
  queued on the device and syncs when online; the name list is only cached if the school accepts it (see §10).
- **Shared board (projected):** Kahoot-style live view: question, timer, answer-count bars, leaderboard, podium. **Default shows card
  number, colour and avatar only.** A teacher switch (option B) shows names; off by default, off again at session end, and each switch
  writes an audit event with no names in it.

### 8.4 Quizzes

- A quiz is a sequence of questions (multiple choice 2–4, true/false, poll), each with time limit, points mode, optional image.
- The agent drafts a quiz from a prompt plus grade, subject and (when supplied) a ratified CAPS reference. Quizzes are learner-blind
  curriculum content. **A teacher approval gate sits before a quiz can run live** (human gate, no bypass).
- Scoring: points by answer speed within the window, streak bonus, ranking by card. **(my call)** Speed is the time from the question
  opening to the teacher closing the scan, entered per scan, since a card has no timestamp of its own; the builder to confirm this is
  a fair measure (it is coarse) or to drop speed points in favour of correctness and streaks.
- Generation needs the missing web → queue → worker path (T05). Grounding and template-fidelity checkers are not wired, so quiz text
  must not be described as checked against CAPS (OQ-063).

### 8.5 Class lists and assignment

- Import is **deterministic**: CSV, Excel, Word tables, text-layer PDF parsed locally; a column-mapping screen lets the teacher confirm.
  A model may see column headers only, never rows. Scanned or photographed lists are not supported in the first release.
- Direct pulls from the school's other systems need a credential, tenant or API the repository does not have; those are recorded as an
  open question and not guessed. File exports are the first path.
- Importing writes `Learner` rows, i.e. identifiable data, so the import is a staged preview the teacher confirms, runs under the
  signed-in teacher's authority for their own classes only, writes an audit event (counts, never names), and must satisfy the existing
  lawful-basis and consent checks. Whether the school has already loaded learners some other way is unknown; the import matches
  existing learners instead of duplicating them, and shows the teacher the matches before saving. **(my call)**
- A session can be assigned to many class sets at once, scheduled ahead, and cloned per term.

### 8.6 Attachments (any format, for reference or embed)

- Any file type or a folder (zip or directory upload, tree preserved) may be **stored**. Only an allow-list is **rendered** inline:
  images, PDF, audio, video, plain text. Everything else (HTML, SVG, scripts, executables, Office files) is **download-only** with a
  warning. **(my call)**
- Stored under a per-tenant prefix with short-lived signed URLs; served from a separate cookieless origin with `Content-Disposition`,
  `nosniff` and a sandboxing CSP, so an uploaded file can never run as the app. Size caps, file-count caps, zip-bomb and path-traversal
  limits.
- A malware scan before a file is made available needs a scanning service (open item, §10). Until one exists the safe default is
  download-only for every file.
- **Agents never read attachment bytes.** A teacher may paste a text excerpt into a prompt; that text goes through the same scrub as the
  assistant. **(my call)** Attachments can contain learner information, so they fall under the retention and erasure path: the
  tombstone flow must reach them.
- Embedding: images, audio, video and PDF can be attached to a question or the board; nothing else embeds.

### 8.7 Photo assessment

- **Marking stays on the phone.** The photo is held on the device for the marking session; the teacher marks each question against the
  memo or rubric on screen. Raw marks per question are saved against the card or learner slot.
- The agent drafts **individual feedback from the marks only** ("2 of 5; missed the carrying question"), with the memo or rubric text
  as context. The teacher reviews and edits before anything is released (human gate). Photos are not uploaded to a model.
- **(my call)** Whether the photo itself is stored is the school's decision (see §10); the default is that it is not.
- Machine reading of handwriting is a later, separately approved step and is not in this design.

### 8.8 Video poll tool

- The phone counts thumbs up/down and raised hands **on the device**; the video is not uploaded by default. Counts fill a graph that is
  rendered as a printable or shareable image containing a code the phone can scan to reopen the data. **(my reading of "photo capturing
  that can be scanned"; to be confirmed.)**
- Assessing what learners _say_ against outcomes needs speech transcription of children's voices; not in scope for the first version.
- Counting accuracy is estimated, not exact; the screen says so and lets the teacher correct the count.

### 8.9 Monitoring, alerts, support resources, assistant

- A rule engine over de-identified per-question and per-learner-slot results runs on each scan batch: e.g. a question most of the
  class missed, a card missed several in a row, participation drop. Alerts are shown to the teacher with the numbers behind them.
- Draft support resources (re-teach activity, practice set) are produced by an agent from de-identified patterns and always need
  teacher approval. Alerts never state a diagnosis, a tier, or a SIAS step. Anything touching SIAS or SBST process is not invented;
  if unclear it goes to `docs/OPEN_QUESTIONS.md`.
- The quick-generation assistant extends `/assistant`: same strict contract, same scrub, same audit shape.

### 8.10 Agent handoff

- New `proposal` record: from-agent, to-agent, payload (pseudonymous references only), status `proposed → approved/rejected →
delivered`. A `to` agent can only receive a proposal once a human with the required role has approved it, and the approval record
  exists before the transition commits (rule 6). **(my call)** The approver is the teacher of the class the proposal concerns
  (`requiredRole: teacher`, as in the MOD-04 pipeline); a proposal with no single responsible teacher goes to the HoD. Allow-lists stay closed; a new tool, `proposal.submit`, is added to named agents
  only. Handoffs appear in the Run Inspector and the audit ledger.

## 9. Stage plan (each stage ends with `pnpm verify:stage`)

1. Card engine v2: 100 patterns, codec, decoder, PDF set, tests.
2. Class sets, roster import, multi-class assignment (tables, RLS, classification, parsers).
3. Scan screen, live board, option-B switch, audit.
4. Quiz studio: agent draft, approval gate, Kahoot-style run, the T05 web route.
5. Attachments (storage, serving origin, allow-list rendering).
6. Monitoring, alerts, support-resource drafts, assistant quick-generation.
7. Agent proposals and handoff.
8. Photo marking and feedback draft.
9. Video poll tool.

## 10. Needs a human (to be added to `docs/OPEN_QUESTIONS.md` with the first stage)

1. Confirm that models never see names, photos, video or handwriting (my reading of the owner's permission); if not, this is a
   POPIA-officer decision and a gateway vision path.
2. POPIA officer: purpose name, categories for photos/video, whether photos are stored, whether a name list may be cached on a phone.
3. A malware-scanning service (or accept download-only for all files).
4. Direct class-list pulls from other systems: which system, and credentials or an export format. Not guessed.
5. Provider pricing and the spend ceiling (OQ-055 D7; gateway cost is zero today).
6. New dependencies to record (rule 9): marker decoder or library, PDF generator, XLSX/DOCX parsers, on-device hand/thumb detection
   (licence to be confirmed before adoption).

## 11. Left to the builder

Exact pattern set and distance; parser libraries; storage service wiring; rule thresholds for alerts; UI layout; test fixtures
(synthetic only, no real learners).

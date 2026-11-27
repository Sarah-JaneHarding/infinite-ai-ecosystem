# Stage 152 — Card engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take `packages/low-tech-assessment` from 40 logical cards to 100 printable cards that a phone camera reads reliably: a pattern table, a codec, a multi-card frame detector and printable PDF sets.

**Architecture:** Pure TypeScript inside the existing package, with no DOM, no Node-only APIs and no dependencies, so the detector can later run in a browser worker on the teacher's phone. Each card is a 7×7 cell square: a black border ring plus a 5×5 grid of data cells. The grid is read as a 25-bit number and matched against all four rotations of 100 stored patterns. The rotation that matches is the answer side.

**Tech Stack:** TypeScript 6.0.3 strict, Zod 4.6.7 and Vitest 5.1.1 (all already in the package). **No new dependency** (the PDF writer and the detector are written in-package; recorded in the Stage log).

**Spec:** `docs/superpowers/specs/2026-11-27-formative-assessment-suite-design.md` §8.2, §9 (stage 1), §10 item 6.

## Global Constraints

- "100 printable cards, bold and simple so a phone camera reads them reliably. Four sides = A, B, C, D."
- "5×5 grid of large cells, black on white, thick quiet border" · "Original pattern; no Plickers artwork."
- "`MAX_CARDS` rises from 40 to 100; the schema, `generateCardSet`, tests and README change with it."
- "Decoder runs in the phone browser (no upload of camera frames)": no DOM, no Node-only APIs, no network, in `src/`.
- "never silently guesses: low confidence prompts a re-scan": a read is correct or absent, never wrong.
- Results are keyed by card number only (a pseudonym). Nothing in this package touches learner data, tenancy, a prompt or a guardrail, so no dedicated security test is required; the "never a wrong card" property tests (Tasks 3 and 5) are the integrity guard.
- Repo rules: strict TS, no `any`, no `@ts-ignore`; no `console.log` (use `process.stdout.write` in scratch commands, never commit it); never skip, weaken or delete a test (rule 2): if a property test fails, the fix is in the code, not the seed or tolerance.
- Every commit: Conventional Commits, ends with the two trailer lines the session requires, and runs `pnpm exec prettier --write` on touched files first (CI's `format:check` failed once on an unformatted doc). Each task is PR-sized (≤ ~400 changed lines excluding the generated table); Tasks 1–3 may share one PR. This session pushes only to `claude/tender-mendel-uxj8qs`, so the next PR starts after the previous one merges and the branch is restarted from `main`.
- Confirm "Stage 152" is still the next number at the end of `docs/STAGE_LOG.md` before starting.

## Decisions this plan makes (the spec left them to the builder)

| Decision           | Value                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pattern spacing    | Every card at every rotation (400 variants) differs from every other by ≥ **8** bits. A throwaway search found 100 patterns at 8; at 9 only 45.                                         |
| Accept rule        | Accept a read only when the nearest variant is ≤ **2** bits away. A wrong card then needs ≥ 6 misread cells.                                                                            |
| Orientation        | No separate cue mark: the four rotations of each pattern differ by ≥ 8 bits, so the pattern itself says which way up it is.                                                             |
| Side from rotation | Canonical card has A at top, B right, C bottom, D left. Rotation _k_ = 90° clockwise turns of the canonical card as seen upright. Side at top = `['A','D','C','B'][k]`.                 |
| Bit order          | Bit _i_ = row·5 + col, row 0 at top, col 0 at left, 1 = black.                                                                                                                          |
| Print layout       | A4 (595.276 × 841.89 pt), 2 × 3 cards per page. Cell 26 pt; card block = 9 cells (234 pt) = 7-cell square plus a 1-cell white quiet margin. Backs mirrored left-right for duplex print. |
| Confidence         | `high`: distance ≤ 1, tilt ≤ 30°, ≥ 5 px per cell. `low`: otherwise, down to 3 px per cell. Under 3 px per cell: no reading.                                                            |
| Pattern selection  | Ascending numeric order, 8 to 17 black cells, greedy. Reproducible; the table is committed and a test regenerates it.                                                                   |

## File structure

All under `packages/low-tech-assessment/`:

- Modify `src/cards.ts` (cap), `src/index.ts` (exports), `test/low-tech-assessment.spec.ts`, `README.md`, `package.json` (nothing unless a script is needed).
- Create `src/marker/grid.ts` (bit-grid helpers, 7×7 bitmap), `src/marker/generate.ts` (pattern search), `src/marker/patterns.ts` (committed table), `src/marker/decode.ts`, `src/marker/detect.ts`, `src/marker/pdf.ts`.
- Create `test/helpers/synth-frame.ts` (test-only frame renderer), `test/marker-patterns.spec.ts`, `test/marker-decode.spec.ts`, `test/marker-detect.spec.ts`, `test/marker-pdf.spec.ts`, `vitest.config.ts`.
- Repo level: `docs/OPEN_QUESTIONS.md`, `docs/STAGE_LOG.md`, `docs/FEATURE_MATRIX.md`, `scripts/verify-stage.ts`.

## Review Focus

Inputs a teacher will hit that the spec does not name, most likely first. Each has a test in the owning task.

1. A blank page, the back of a card, or any printed square that is not one of ours: no reading, never a wrong card (Task 5).
2. Cards far from the camera or low resolution: under 3 px per cell no reading, 3–5 px `low` (Task 5).
3. A dim room, a low-contrast image, or a dark desk or uniform behind the card (Task 5).
4. Two learners standing close: cards touching or overlapping, or a card cut off by the image edge: each is read correctly or omitted, never merged into a wrong card (Task 5).
5. Two learners holding the same card number in one frame (a duplicate print): both readings returned; de-duplication belongs to the existing tally (Task 4).

---

### Task 1: Raise the cap to 100 and record the open questions

**Files:**

- Modify: `src/cards.ts` (`MAX_CARDS`, comments), `test/low-tech-assessment.spec.ts`, `README.md`
- Modify: `docs/OPEN_QUESTIONS.md` (new entry `OQ-064`)

**Interfaces:**

- Produces: `MAX_CARDS = 100`; `generateCardSet(count)` valid for 1–100 with codes `LTA-01`…`LTA-100` (width-2 zero pad; 100 is `LTA-100`, label `'100'`). The first 40 codes are unchanged so existing printed sets still match.

- [ ] **Step 1: Write the failing tests** in `test/low-tech-assessment.spec.ts`:
      `MAX_CARDS is 100`; `generates 100 cards with unique numbers, labels and codes` (last is `{ cardNumber: 100, slotLabel: '100', code: 'LTA-100' }`); `keeps the codes of cards 1 to 40 unchanged` (`LTA-01`…`LTA-40`); `throws for count 101` (RangeError).
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/low-tech-assessment test` · Expected: the new cap tests FAIL.
- [ ] **Step 3: Implement** `MAX_CARDS = 100` in `src/cards.ts` and fix its comments. Update the README ("40 by default" becomes 100).
- [ ] **Step 4: Add `OQ-064`** to `docs/OPEN_QUESTIONS.md` in the file's existing format (`### OQ-064 — … · 2026-11-27`): copy design §10 items 1–5 verbatim, each tagged with the first stage that needs it: 1 → Stages 6 and 8; 2 → Stages 3 and 8; 3 → Stage 5; 4 → Stage 2; 5 → Stage 4. Item 6 is resolved by this plan (no dependency added).
- [ ] **Step 5: Run** the package tests, `pnpm --filter @infinite-ai/low-tech-assessment typecheck`, `pnpm exec prettier --write` on touched files, then `pnpm format:check`. Expected: all pass. **Commit** `feat(low-tech): raise the card cap to 100 and record the suite's open questions`.

### Task 2: Grid helpers, pattern search and the committed table

**Files:**

- Create: `src/marker/grid.ts`, `src/marker/generate.ts`, `src/marker/patterns.ts`
- Test: `test/marker-patterns.spec.ts`

**Interfaces:**

- Consumes: `MAX_CARDS` from `src/cards.ts`.
- Produces (`grid.ts`):
  `GRID = 5`, `CARD_CELLS = 7`,
  `rotateGrid(bits: number): number` (90° clockwise: the cell at row _r_, col _c_ moves to row _c_, col 4−*r*),
  `hamming(a: number, b: number): number`,
  `patternFor(cardNumber: number): number` and `cardBitmap(cardNumber: number): readonly (readonly boolean[])[]` (7×7, row 0 top, border ring all `true`, data cells from the pattern; both throw `RangeError` outside 1–`MAX_CARDS`).
- Produces (`generate.ts`):
  `interface PatternSearch { count: number; minDistance: number; minBlack: number; maxBlack: number; maxCandidates?: number }`,
  `const PATTERN_SEARCH: PatternSearch = { count: 100, minDistance: 8, minBlack: 8, maxBlack: 17 }`,
  `generatePatterns(search: PatternSearch): readonly number[]` (greedy, ascending candidates from 1; `RangeError` on `count < 1`, `minDistance < 1`, `minBlack > maxBlack`, or fewer than `count` found within `maxCandidates`, default 2^25).
- Produces (`patterns.ts`): `MARKER_PATTERNS: readonly number[]` (100 entries, the output of `generatePatterns(PATTERN_SEARCH)`), `MARKER_MIN_DISTANCE = 8`.

- [ ] **Step 1: Write the failing tests:**
  - `rotateGrid four times returns the input` (several values); `rotateGrid moves the top-left cell to the top-right` (`rotateGrid(1)` is `1 << 4`).
  - `hamming counts differing bits`.
  - `MARKER_PATTERNS has MAX_CARDS entries, each within 25 bits with 8 to 17 black cells`.
  - `all 400 rotation variants are at least MARKER_MIN_DISTANCE apart` (includes the four rotations of one pattern against each other) and `MARKER_MIN_DISTANCE is 8`.
  - `regenerates identically from PATTERN_SEARCH` (timeout 30 000 ms).
  - `generatePatterns rejects count 0, minDistance 0, minBlack above maxBlack, and exhausted maxCandidates (50)`.
  - `cardBitmap: border ring is black, data cells equal the pattern bits, and it throws for 0 and 101`.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/low-tech-assessment test marker-patterns` · Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `grid.ts` and `generate.ts`** with the signatures above. Then print the table once (a scratch command outside the repo, writing via `process.stdout.write`) and paste it into `patterns.ts` with a header comment saying it is generated and a test regenerates it. Export all of it from `src/index.ts`.
- [ ] **Step 4: Run** the tests, typecheck, lint, prettier · Expected: PASS.
- [ ] **Step 5: Commit** `feat(low-tech): 100 card patterns, 8 bits apart across every rotation`.

### Task 3: Grid decoder with the "never a wrong card" property

**Files:**

- Create: `src/marker/decode.ts`
- Test: `test/marker-decode.spec.ts`

**Interfaces:**

- Consumes: `MARKER_PATTERNS`, `rotateGrid`, `hamming`, `CardSide`.
- Produces:
  `MAX_CORRECTABLE_BITS = 2`,
  `type Rotation = 0 | 1 | 2 | 3`,
  `interface GridMatch { cardNumber: number; rotation: Rotation; side: CardSide; distance: number }`,
  `sideForRotation(rotation: Rotation): CardSide` (`['A','D','C','B'][rotation]`),
  `decodeGrid(bits: number): GridMatch | null` (`bits` is the upright-view 25-bit grid; `RangeError` if not an integer in 0 to 2^25−1; returns the nearest of the 400 variants only if its distance ≤ `MAX_CORRECTABLE_BITS`).

- [ ] **Step 1: Write the failing tests:**
  - `decodes every card in every rotation with distance 0` (400 cases; `side` equals `sideForRotation(k)`).
  - `sideForRotation maps 0,1,2,3 to A,D,C,B`.
  - `corrects every 1-bit and 2-bit flip to the same card and rotation` (reports `distance` equal to the flips).
  - `never returns a different card for any 3-bit flip` (null or same card and rotation).
  - `never returns a different card for 20 000 seeded 4-bit and 5-bit flips`.
  - `returns null for the all-white and all-black grids`.
  - `throws RangeError for a negative, fractional or oversize value`.
- [ ] **Step 2: Run** `... test marker-decode` · Expected: FAIL.
- [ ] **Step 3: Implement `decode.ts`.** Precompute the 400 variants at load; linear scan for the minimum distance. Export from `src/index.ts`.
- [ ] **Step 4: Run** tests, typecheck, lint, prettier · Expected: PASS.
- [ ] **Step 5: Commit** `feat(low-tech): grid decoder that corrects 2 misread cells and never confuses cards`.

### Task 4: Synthetic frames and the clean-image detector

**Files:**

- Create: `test/helpers/synth-frame.ts`, `src/marker/detect.ts`
- Test: `test/marker-detect.spec.ts`

**Interfaces:**

- Consumes: `cardBitmap`, `CARD_CELLS`, `decodeGrid`, `sideForRotation`, `rotateGrid`.
- Produces (`detect.ts`):
  `interface GrayFrame { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }` (row-major, 0 = black),
  `interface MarkerReading { cardNumber: number; side: CardSide; distance: number; confidence: 'high' | 'low'; centre: { x: number; y: number }; sidePx: number; tiltDeg: number }`,
  `detectCards(frame: GrayFrame): readonly MarkerReading[]` (sorted by `centre.y`, then `centre.x`; `RangeError` if `width` or `height` is not a positive integer or `data.length !== width * height`).
- Produces (`synth-frame.ts`, test-only):
  `interface PlacedCard { cardNumber: number; side: CardSide; centre: { x: number; y: number }; sidePx: number; angleDeg?: number; tiltDeg?: number }` (`sidePx` = the 7-cell square; a 1-cell white quiet margin is drawn around it),
  `interface Impairments { background?: number; blurRadius?: number; noiseSigma?: number; seed?: number; glare?: { cx: number; cy: number; radius: number; strength: number }; occlude?: readonly { cardIndex: number; cells: readonly (readonly [col: number, row: number])[]; value: 0 | 255 }[]; contrast?: readonly [low: number, high: number] }`,
  `renderFrame(width: number, height: number, cards: readonly PlacedCard[], impairments?: Impairments): GrayFrame`.
  Defaults: background 200, no blur or noise. `tiltDeg` t: the right edge is shortened to (1 − 0.4·sin t) of the left edge, vertically centred, and width scaled by cos t. Noise is seeded (mulberry32), never `Math.random`.

Detector pipeline (the decisions the signatures do not give): global Otsu threshold (frame contrast under 30 → `[]`); 4-connected components of dark pixels with an explicit stack, no recursion; skip components touching the frame edge, with side under 21 px, or covering ≥ 95% of the frame; convex hull of the boundary; largest-area inscribed quadrilateral of the hull (cap the hull at 64 vertices, ≤ O(h²)); order the corners clockwise starting at the left end of the topmost edge, with `tiltDeg` = that edge's angle from horizontal; homography to the 7×7 grid, sampling each cell centre as a 3×3 mean; per-card threshold = midpoint of the mean of the 24 border samples and the brightest data sample; require ≥ 22 of 24 border cells dark; build the 25-bit grid; `decodeGrid`. `confidence` per the Decisions table.

- [ ] **Step 1: Write the failing tests:**
  - helper sanity: `renderFrame puts a black border pixel at the card edge and a white pixel in the quiet margin`.
  - `reads every card 1 to 100 on all four sides at 24 px per cell` (400 frames; asserts number, side, `distance` 0, `confidence` 'high').
  - `reports centre and side length within 2 px`.
  - `reads nine different cards in one 1280×720 frame` (set equality of number and side).
  - `returns both readings when two learners hold the same card number` (**Review Focus 5**).
  - `returns [] for a blank frame`.
  - `throws RangeError for a data length mismatch, a zero width and a fractional height`.
- [ ] **Step 2: Run** `... test marker-detect` · Expected: FAIL.
- [ ] **Step 3: Implement `synth-frame.ts` then `detect.ts`** to the interfaces and pipeline above. Export `detectCards`, `GrayFrame`, `MarkerReading` from `src/index.ts` (the helper stays test-only).
- [ ] **Step 4: Run** tests, typecheck, lint, prettier · Expected: PASS.
- [ ] **Step 5: Commit** `feat(low-tech): detect several cards in one camera frame`.

### Task 5: Robustness and the "never a wrong card" frame suite

**Files:**

- Modify: `src/marker/detect.ts` (only where a test below forces it)
- Test: `test/marker-detect.spec.ts`

**Interfaces:** none new. Uses `renderFrame` and `Impairments` from Task 4.

- [ ] **Step 1: Write the failing tests** (all with a fixed seed):
  - `reads at in-plane angles of 0, 10, 20 and 25 degrees with the same number and side`.
  - `at 40 degrees reports low confidence` (tilt over 30°).
  - `reads through perspective tilt of 30 degrees`.
  - `reads through blur radius 2 and noise sigma 12` (24 px per cell).
  - `reads under moderate glare` (strength 60, radius 0.6 of the card side).
  - `still reads when any two data cells are covered` (white and black occluders; at most 2 cells, so inside the 2-bit budget).
  - **Review Focus 1:** `no reading for the back of a card (plain white square)`, `no reading for a 7×7 grid with a black border and a random inside that is over 2 bits from every card` (50 seeded grids), `no reading for a uniform grey frame`.
  - **Review Focus 2:** `no reading when a card is 20 px wide`, `low confidence at 28 px, high at 35 px or more`.
  - **Review Focus 3:** `reads at contrast 90 to 140`, `reads a card against a dark background (value 60)` (the quiet margin keeps the border separate).
  - **Review Focus 4:** `a card cut by the frame edge gives no reading`, `two cards whose squares overlap give only correct readings` (a subset of the truth, never a wrong number).
  - **Property:** `over 300 seeded random trials (card, side, size 80 to 220 px, angle ±25°, noise 0 to 25, blur 0 to 2, glare 0 to 200, up to 3 occluded cells) a reading is either absent or has the true card number and side`.
- [ ] **Step 2: Run** `... test marker-detect` · Expected: the tests that expose gaps FAIL; note which.
- [ ] **Step 3: Fix the detector** only where a test forces it (typical: tighten the border check, reject non-square quads, require a margin). The property test and the Review Focus tests are never weakened; if one fails, fix the code.
- [ ] **Step 4: Run** the full package tests, typecheck, lint, prettier · Expected: PASS.
- [ ] **Step 5: Commit** `test(low-tech): a card read is correct or absent, under blur, glare, tilt and cover`.

### Task 6: Printable PDF sheets

**Files:**

- Create: `src/marker/pdf.ts`
- Test: `test/marker-pdf.spec.ts`

**Interfaces:**

- Consumes: `cardBitmap`, `CARD_CELLS`, `MAX_CARDS`.
- Produces:
  `CELL_PT = 26`, `BLOCK_PT = 234`, `CARDS_PER_PAGE = 6`,
  `interface SheetOptions { readonly cards: readonly number[]; readonly face: 'front' | 'back' }`,
  `blockOrigin(slot: number, face: 'front' | 'back'): { x: number; y: number }` (bottom-left of the block; slot 0 to 5, row-major from top-left; 'back' mirrors the column; the 468 × 702 pt grid is centred on A4),
  `renderCardSheetPdf(options: SheetOptions): Uint8Array` (hand-written PDF 1.4: catalog, page tree, standard Helvetica-Bold, one content stream per page, correct `xref` offsets, ASCII only, no timestamps so output is deterministic; `RangeError` for an empty list, a number outside 1 to 100, or a duplicate).

PDF content rules:

- **Front:** each black cell is its own `x y 26 26 re f` (numbers to 3 decimals), border ring plus black data cells, so a test can rebuild the bitmap.
- Letters are Helvetica-Bold 20 pt in the quiet margin at each edge midpoint, with these `Tm` matrices (PDF y is up): A top `1 0 0 1`, B right `0 -1 1 0`, C bottom `-1 0 0 -1`, D left `0 1 -1 0`. Each letter reads upright when its edge is at the top.
- Advance widths per 1000 em: A–D 722, digits 556.
- The two-digit card number is printed at 10 pt at the block's top-left margin, and a light-grey 0.5 pt outline marks the cut line.
- **Back:** the number at 120 pt centred in the block, no pattern cells.

- [ ] **Step 1: Write the failing tests:**
  - `starts with %PDF-1.4, ends with %%EOF`, and `page count is ceil(n / 6)` (100 cards → 17).
  - `every xref entry points at its "N 0 obj"`.
  - `front: the filled 26 pt squares for slot 0 rebuild cardBitmap(card)` for 5 chosen cards.
  - `front: letters A to D carry the pinned rotation matrices and sit inside their edge's margin band`.
  - `back: has the number at 120 pt and no 26 pt cells; back slot 0 sits where front slot 1 does` (duplex mirror).
  - `output is byte-identical across two calls`.
  - `throws RangeError for [], [0], [101] and [3, 3]`.
- [ ] **Step 2: Run** `pnpm --filter @infinite-ai/low-tech-assessment test marker-pdf` · Expected: FAIL.
- [ ] **Step 3: Implement `pdf.ts`.** Compute `xref` offsets from the assembled byte lengths; encode with `TextEncoder`. Export from `src/index.ts`.
- [ ] **Step 4: Run** tests, typecheck, lint, prettier · Expected: PASS.
- [ ] **Step 5: Commit** `feat(low-tech): printable A4 card sheets, fronts and mirrored backs`.

### Task 7: Docs, coverage gate and Stage log

**Files:**

- Create: `vitest.config.ts` (package)
- Modify: `README.md`, `scripts/verify-stage.ts`, `docs/STAGE_LOG.md`, `docs/FEATURE_MATRIX.md`

- [ ] **Step 1: Add `vitest.config.ts`** modelled on `packages/policy/vitest.config.ts`: include `test/**/*.spec.ts`, v8 coverage over `src/**/*.ts`, thresholds 90 for lines, branches, functions and statements. Run `pnpm --filter @infinite-ai/low-tech-assessment test:coverage` · Expected: meets 90. If not, add tests for the uncovered branches; never lower the number.
- [ ] **Step 2: README:** describe the marker format, the decode rule, the print layout, how to regenerate the table, and that the package still has no camera, database or model calls.
- [ ] **Step 3: Register the stage:** append `{ id: '152', name: 'Card engine v2 (formative assessment stage 1)', commands: ['pnpm --filter @infinite-ai/low-tech-assessment test:coverage'] }` to `STAGES` in `scripts/verify-stage.ts`, and check how the runner orders ids. Update the Stage 23 comment's stale test count.
- [ ] **Step 4: `docs/FEATURE_MATRIX.md`:** add one row in §6 for the card engine, status **Not reachable**: engine, detector and print files exist; no screen, camera page or saved results.
- [ ] **Step 5: `docs/STAGE_LOG.md`:** add `## Stage 152 — …` in the existing style: what changed, defects found, **Not verified** (a printed set read by a real phone camera; the cumulative `verify:stage` gate needs Docker, so CI proves it) and an exit-gate table (below).
- [ ] **Step 6: Run** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm verify:stage 152` (the cumulative gate may fail locally on Docker-only suites; record exactly which). **Commit** `docs(low-tech): record Stage 152 and gate the card engine`.

## Exit gate (walk item by item into the Stage log)

| Item                                                                   | Evidence                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| 100 cards, codes unchanged for 1 to 40                                 | Task 1 tests                                    |
| 400 variants ≥ 8 bits apart; table regenerates identically             | Task 2 tests                                    |
| Decoder corrects 2 bits; no wrong card for 3-, 4- or 5-bit errors      | Task 3 tests                                    |
| All 400 card and side combinations read; multi-card frames; duplicates | Task 4 tests                                    |
| Blur, glare, tilt, cover, dim room, far card: correct or absent        | Task 5 tests incl. 300-trial property           |
| PDF draws exactly the bitmap the detector expects                      | Task 6 round-trip                               |
| Coverage ≥ 90, lint, typecheck, format, Stage 23 tests unchanged       | Task 7                                          |
| No new dependency; no tenancy, PII, prompt or guardrail touched        | Stage log                                       |
| **Printed set read by a real phone camera**                            | **NOT VERIFIED here; first checked in Stage 3** |

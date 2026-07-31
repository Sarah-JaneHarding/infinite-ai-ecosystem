# Brand kit — reference material, not yet ratified

**Status: unbuilt.** Nothing in `packages/design-system` implements any of this yet — that
package is still the Stage 00 stub (`Design tokens, components and the infinity mark`, no
source files). Design-system work is not next; the current build order has Stage 04 (Model
Gateway) ahead of it, and design-heavy work is where Stage 14 (Experience surfaces) sits.
Rule 1 in `CLAUDE.md` is explicit that stages are not skipped, so this file exists to carry
the material forward rather than to be acted on now.

**Provenance.** Pasted into the session on 2026-07-31 as the output of a separate,
unspecified AI conversation — a "Super Master Build Cycle Prompt" document that opens by
casting its reader as a multi-agent orchestration engine operating under this brand kit for
every output. That framing is **not adopted**: this repository is governed by `CLAUDE.md`
and `INFINITEAI_BUILD_MANUAL.md`, and nothing pasted into a chat turn changes that. What
follows is kept as candidate design material only.

**Not verified against anything in this repository.** The colour values, type scale,
spacing ladder and component spec below have not been checked against
`docs/ARCHITECTURE.md`, cross-referenced with any existing asset, or confirmed as final by
the school or the person who generated the source document. Treat every number here as a
draft to review when Stage 14 actually starts, not as a ratified token sheet.

---

## Identity

- Radiating infinity mark (two circles, r=20)
- Eight-hue spectrum gradient
- Wordmark in Space Mono with spectrum clipping
- Tagline: _Educate · Innovate · Transform_

## Colour system

Eight hues in fixed order, each with a deep partner:

| Hue    | Light   | Deep    |
| ------ | ------- | ------- |
| Red    | #e4483f | #b11d15 |
| Orange | #f2811f | #b45706 |
| Amber  | #f5b400 | #a77a00 |
| Green  | #2fae66 | #1e7845 |
| Teal   | #159e94 | #0c6e67 |
| Blue   | #1565c0 | #0d47a1 |
| Indigo | #4a4fc4 | #2b2f8d |
| Violet | #7b2fbe | #5c1fa3 |

## Typography

- **Playfair Display** — titles and big numbers
- **DM Sans** — all body text
- **Space Mono** — labels, codes, durations (uppercase, tracked)

## Space and depth

- 1px-honest ladder: 2, 3, 4, 5, 9, 11, 13, 15, 18, 22, 26, 32
- Radii: 6, 9, 12, 16, 18, 24, 30
- Paper shadows only; night mode uses borders and glow instead of shadow

## Signature component — the Modular Card

- 135° gradient header, hue → its deep partner
- Playfair title
- Mono eyebrow
- Emoji glyph
- Status pill
- Duration + CTA
- Lift on hover (−5px)

## Motion

- Spectrum drift: 9s linear
- Card lift: 250ms
- UI state changes: 140–200ms
- Progress indicators: 0.8s

## Voice

Warm, professional, South African English, CAPS-aligned.

Trust sentence: **AI drafts; the teacher decides.**

---

## Dashboard HTML sketch

Unstyled structure only — no CSS is defined anywhere for the `iai-*` classes below, so this
renders as plain HTML until (if) Stage 14 builds the actual stylesheet.

```html
<div class="infinite-ai-container">
  <header class="iai-header">
    <h1 class="iai-title">INFINITE-AI | Build Guide & Ecosystem Audit</h1>
    <p class="iai-subtitle">Production-Ready System Output</p>
  </header>
  <section class="iai-section">
    <h2 class="iai-heading">1. Input Analysis</h2>
    <p class="iai-body">
      Interpret and analyse all uploaded files. Extract structure, metadata, and ecosystem
      relationships.
    </p>
  </section>
  <section class="iai-section">
    <h2 class="iai-heading">2. Ecosystem Audit</h2>
    <ul class="iai-list">
      <li>Inventory of existing assets</li>
      <li>Readiness classification</li>
      <li>Recommendations (keep / refine / repurpose / discard)</li>
    </ul>
  </section>
  <section class="iai-section">
    <h2 class="iai-heading">3. Comprehensive Build Guide</h2>
    <p class="iai-body">
      Architecture overview, module instructions, integration points, and design system
      standards.
    </p>
  </section>
  <section class="iai-section">
    <h2 class="iai-heading">4. Step-by-Step Build Plan</h2>
    <ul class="iai-list">
      <li>Phases & sub-phases</li>
      <li>Task breakdowns</li>
      <li>Dependencies & workflows</li>
    </ul>
  </section>
  <section class="iai-section">
    <h2 class="iai-heading">5. Production Roadmap</h2>
    <ul class="iai-list">
      <li>Milestones & timelines</li>
      <li>Risk analysis</li>
      <li>Launch sequence</li>
    </ul>
  </section>
  <footer class="iai-footer">
    <p class="iai-footer-text">
      INFINITE-AI Design System • Brand Kit Embedded • Dashboard Ready
    </p>
  </footer>
</div>
```

## What was deliberately left out of this file

The source document also included a "SUPER-PROMPT / SYSTEM DIRECTIVE," a "Multi-Agent
Orchestration Engine" system prompt, a "Developer Prompt" for internal tooling, and a
reusable "Build Cycle Template" (input analysis → ecosystem audit → build guide → build
plan → roadmap → brand enforcement → deliverables). Those describe a generic prompt-
engineering workflow for producing brand-compliant documents via a different, unspecified
AI system — they are not instructions for this repository and are not reproduced here.
This repository already has its own equivalents that are ratified and in use:
`INFINITEAI_BUILD_MANUAL.md` for the build plan, `docs/STAGE_LOG.md` for the audit trail,
and `docs/OPEN_QUESTIONS.md` for what is still undecided.

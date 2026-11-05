# INFINITE-AI · The Educator's Ecosystem — marketing site (archived draft)

A single-page marketing site (home, our story, ecosystem, trust and security, stakeholders, cost and access,
roadmap, contact) supplied by Sarah-Jane Harding on 2026-11-05 as `INFINITE-AI___The_Educators_Ecosystem.html`.

**Status: archived, not served.** It lives under `docs/`, like `docs/brand-identity.html`, so it is not part of the
web app and nothing publishes it. Publishing is blocked on OQ-042.

## What changed from the supplied file

- The nine inline base64 images (5.86 MB) were moved out into `images/` as WebP (about 125 KB in total). The page
  is otherwise the supplied markup, re-indented by Prettier so the repo format check passes.
- No wording was edited. The wording, the claims and the contact form are exactly as supplied.

Open `index.html` in a browser to view it. It loads Space Grotesk, Inter and Space Mono from Google Fonts and falls
back to system fonts when offline.

## Before it can go public (see OQ-042)

| Item                           | In the draft                                                       | Check                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Build-stage count              | "52 build stages", stated four times                               | `docs/STAGE_LOG.md` now records stages beyond 110, so the number is stale                                                               |
| "Production-grade", "complete" | Roadmap and trust copy                                             | `docs/OPEN_QUESTIONS.md` still lists integration decisions open before any school goes live                                             |
| Hosting claim                  | "hosted on South African soil (AWS af-south-1)"                    | `docs/ARCHITECTURE.md` names `af-south-1` as the production region; confirm it is true on the day the page publishes                    |
| Contact form                   | Posts name, email, phone and school to a Google Form (placeholder) | Collects personal information, so it needs a POPIA notice, a named responsible party and an operator agreement before the URL is filled |
| Roadmap dates                  | Q3 2026, Q4 2026, 2027, 2028+                                      | Founder to confirm they are commitments she is willing to publish                                                                       |
| Fonts                          | Google Fonts request on every visit                                | Self-host if the site must make no third-party requests                                                                                 |
| Editor hint                    | "Click any text to edit" bar at the foot of the page               | Authoring helper; remove before publishing                                                                                              |

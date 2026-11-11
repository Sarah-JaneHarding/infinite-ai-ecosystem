# INFINITE-AI · The Educator's Ecosystem — marketing site (archived draft)

A single-page marketing site (home, our story, ecosystem, trust and security, stakeholders, cost and access,
roadmap, contact) supplied by Sarah-Jane Harding on 2026-11-05 as `INFINITE-AI___The_Educators_Ecosystem.html`.

**Status: archived, not served.** It lives under `docs/`, like `docs/brand-identity.html`, so it is not part of the
web app and nothing publishes it. Publishing is blocked on OQ-042.

## What changed from the supplied file

- The nine inline base64 images (5.86 MB) were moved out into `images/` as WebP (about 125 KB in total).
  The markup is re-indented by Prettier so the repo format check passes.
- **Facts corrected on 2026-11-05:**
  - "52 build stages" (four places) is now "more than 110", matching `docs/STAGE_LOG.md` (stage 113 is the latest).
  - "Production-grade code" and "enterprise-grade security" are replaced by what the repo shows: strict typing,
    automated tests and privacy guardrails enforced in code.
  - "Hosted on South African soil (AWS af-south-1)" is now "designed for" it, because `docs/ARCHITECTURE.md` names
    `af-south-1` as the production region but no school is live yet.
  - Roadmap stage 1 now says Term 4 2026 and a pilot cohort of three schools with the first confirmed, as in
    `docs/PILOT_PROTOCOL.md`. Stages 2 to 4 lost their dates (Q4 2026, 2027, 2028+), which nothing in the repo supports.
- **Contact form:** the Google Form POST (a placeholder URL) and its hidden iframe are gone. Pressing Send now only
  opens the visitor's own email app with the details filled in, so no third-party form service holds them. A
  short notice sits above the button.
- **New page:** a POPIA privacy notice (`#page-privacy`, linked from the form, the contact copy and the footer).

Open `index.html` in a browser to view it. It loads Space Grotesk, Inter and Space Mono from Google Fonts and falls
back to system fonts when offline. The privacy notice says so.

## Before it can go public (see OQ-042)

| Item                | Check                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Responsible party   | The notice says "INFINITE-AI, Durban". Add the legal entity name once it is confirmed                        |
| Information Officer | Confirm one is appointed and registered with the Information Regulator, then name them in the notice         |
| Retention           | The notice says "only as long as we need it". Set a concrete period if you want one                          |
| Roadmap             | Stages 2 to 4 are now undated. Decide whether to publish dates                                               |
| Hosting claim       | Re-check "designed for af-south-1" on the day the page publishes                                             |
| Fonts               | Self-host the three fonts if the site must make no third-party requests, then drop that line from the notice |
| Editor hint         | "Click any text to edit" bar at the foot of the page is an authoring helper; remove before publishing        |

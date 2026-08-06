# Champion results

One `<agent-id>.json` file per agent, holding that agent's last-promoted `EvalRunResult`
(`packages/evals/src/champion-store.ts`, Stage 07 step 5) — the baseline `pnpm evals:gate`
and `decidePromotion` (step 4) both compare a challenger run against. Written by
`saveChampionResult`, read by `loadChampionResult`; a missing file means "no champion yet,"
not an error — both the CI gate and the promotion decision already treat that as "nothing
to compare against" rather than a failure.

Empty today, for the same reason `packages/evals/sets/` is: no agent has been promoted yet,
since none exist. Committed here (not `.gitignore`d) because a champion result changing is
itself a fact worth a commit message and a review, the same reasoning golden sets
themselves already get.

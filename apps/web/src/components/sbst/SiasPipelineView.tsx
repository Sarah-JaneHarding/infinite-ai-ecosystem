import { Card } from '@infinite-ai/design-system';

// This tab used to show five invented cases (SIAS-001 … SIAS-005) across four invented
// "phases", with made-up stages and review dates, under a footer asserting what the DoE SIAS
// Guidelines (2014) require and when escalation to the district occurs. None of that is
// real or sourced:
//  - the app stores no SIAS cases yet, so there is nothing to list;
//  - the four-phase model was invented here and contradicts the ratified SIAS state machine
//    (`packages/analytics` sias-state: ten states, with SBST ratification before any tier
//    change, referral or exit);
//  - the escalation rule was never supplied by a source document (CLAUDE.md: never invent
//    SIAS process steps).
// So the tab says it is not available and describes no process, no phase and no deadline.

export function SiasPipelineView() {
  return (
    <Card>
      <p role="status" className="text-sm font-semibold text-[var(--iai-text)] mb-2">
        Not available yet
      </p>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-2">
        SIAS cases are not stored in the app yet, so there is no case pipeline to show.
      </p>
      <p className="text-sm text-[var(--iai-text-subtle)]">
        When cases are recorded they will appear here. Until then this tab shows no
        example cases, stages or review dates.
      </p>
    </Card>
  );
}

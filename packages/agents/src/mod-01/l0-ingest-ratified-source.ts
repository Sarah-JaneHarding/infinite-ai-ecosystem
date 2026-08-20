// l0.ingest_ratified_source tool declaration — Stage 31.
//
// This tool is the first step in the MOD-01 curriculum pipeline (mod-01.ts:24).
// It is a readiness gate: it verifies that L0 constitution records (CAPS_CANON and
// ATP_CALENDAR) have been ratified for the tenant before CE-01 attempts to retrieve them.
// If L0 is empty the pipeline fails early with a clear error rather than CE-01 returning
// FrameworkNeedsInput for every subject.
//
// The tool is read-only and idempotent — it reads brain_constitution, nothing is written.

import { CE01Input } from '@infinite-ai/contracts';

import {
  ToolDeclaration,
  type ToolDeclaration as ToolDeclarationType,
} from '../contract.js';

export const L0IngestRatifiedSourceDeclaration: ToolDeclarationType =
  ToolDeclaration.parse({
    name: 'l0.ingest_ratified_source',
    purpose:
      'Verify that ratified CAPS and ATP constitution records exist in L0 for the tenant before CE-01 runs. Fails fast if L0 is empty.',
    inputSchema: CE01Input,
    idempotent: true,
    sideEffect: 'read',
  });

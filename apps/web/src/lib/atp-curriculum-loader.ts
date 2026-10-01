// The one database read behind the Teacher Studio Curriculum Map.
//
// Rule 5: every read goes through `withTenant`, with the tenant and actor taken from the
// caller's verified session — never from the request. RLS is the second line of defence.
//
// `listEffectiveConstitution` already returns only the effective (non-superseded) version
// of each fact (rule 11), so a superseded ATP is never shown. It returns every kind, and
// this filters to `ATP_CALENDAR` in `buildCurriculumMap`; a kind-filtered query in
// `@infinite-ai/db` would avoid reading the other kinds, but that is a package change of
// its own.

import { listEffectiveConstitution, withTenant } from '@infinite-ai/db';

import { buildCurriculumMap, type CurriculumMapData } from './atp-curriculum';

export interface CurriculumScope {
  readonly tenantId: string;
  readonly actorId: string;
}

export async function loadCurriculumMap(
  scope: CurriculumScope,
  requestedGrade: string | undefined,
  requestedSubject: string | undefined,
): Promise<CurriculumMapData> {
  const rows = await withTenant(
    { tenantId: scope.tenantId, actorId: scope.actorId },
    (tx) => listEffectiveConstitution(tx),
  );
  return buildCurriculumMap(rows, requestedGrade, requestedSubject);
}

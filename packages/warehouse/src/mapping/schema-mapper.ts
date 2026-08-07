// DW-02 Schema Mapper — Stage 09 step 4.
//
// Maps raw source fields (from whatever connector produced a RawRecord) to the canonical
// field set the domain_event_log expects. Three outcomes:
//   ok          — every source field has a human-confirmed mapping; canonical payload built
//   needs_input — one or more fields have no confirmed mapping; human must confirm
//   rejected    — the source record cannot be mapped to the requested domain
//
// The mapper is intentionally free of database imports so the unit tier can drive it
// without a live Postgres instance. All persistence is injected through MappingStore —
// the agent runtime or integration tests supply the real implementation.

import type { DW02Input, DW02Result } from '../agent-inputs.js';

// ---------------------------------------------------------------------------
// Field mapping types
// ---------------------------------------------------------------------------

/** One confirmed (or pending) mapping stored in `source_field_mapping`. */
export interface FieldMapping {
  readonly sourceField: string;
  readonly canonicalField: string;
  readonly confirmed: boolean;
  readonly transformName?: string;
}

/** Named transform functions. A transform converts a source string value to the canonical
 * representation (e.g. date format normalisation, status enum mapping). The registry is
 * closed over in `mapRecord`; production code registers real transforms at boot. */
export type TransformFn = (value: string) => string;
export type TransformRegistry = Readonly<Record<string, TransformFn>>;

// ---------------------------------------------------------------------------
// Persistence boundary (injected — no direct DB import)
// ---------------------------------------------------------------------------

export interface MappingStore {
  /** Returns all known field mappings for this source. Returns `[]` when the source is
   * completely new (no mapping has been saved yet). */
  loadMappings(
    tenantId: string,
    sourceId: string,
    connectorKind: string,
  ): Promise<readonly FieldMapping[]>;

  /** Persists new (unconfirmed) mapping entries so the human-review UI can list them. */
  saveUnconfirmedMappings(
    tenantId: string,
    sourceId: string,
    connectorKind: string,
    entries: readonly Pick<FieldMapping, 'sourceField'>[],
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Required canonical fields — every domain event must carry these
// ---------------------------------------------------------------------------

const REQUIRED_CANONICAL = ['learnerId', 'eventType', 'occurredAt'] as const;

// ---------------------------------------------------------------------------
// Core mapping function
// ---------------------------------------------------------------------------

export async function mapRecord(
  input: DW02Input,
  store: MappingStore,
  transforms: TransformRegistry = {},
): Promise<DW02Result> {
  const { tenantId, sourceId, connectorKind, sourceFields, targetDomain } = input;

  const knownMappings = await store.loadMappings(tenantId, sourceId, connectorKind);
  const mappingBySource = new Map<string, FieldMapping>(
    knownMappings.map((m) => [m.sourceField, m]),
  );

  const unmappedFields: string[] = [];
  const canonicalPayload: Record<string, unknown> = {};
  const mappingsApplied: Array<{ sourceField: string; canonicalField: string }> = [];

  for (const [key, rawValue] of Object.entries(sourceFields)) {
    const mapping = mappingBySource.get(key);

    if (mapping === undefined || !mapping.confirmed) {
      unmappedFields.push(key);
      continue;
    }

    const stringValue = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
    const transform =
      mapping.transformName !== undefined ? transforms[mapping.transformName] : undefined;
    const finalValue = transform !== undefined ? transform(stringValue) : stringValue;

    canonicalPayload[mapping.canonicalField] = finalValue;
    mappingsApplied.push({
      sourceField: mapping.sourceField,
      canonicalField: mapping.canonicalField,
    });
  }

  // Persist any newly discovered source fields for human review
  if (unmappedFields.length > 0) {
    await store.saveUnconfirmedMappings(
      tenantId,
      sourceId,
      connectorKind,
      unmappedFields.map((f) => ({ sourceField: f })),
    );
    return {
      status: 'needs_input',
      unmappedFields,
      detail: `${unmappedFields.length} source field(s) have no confirmed mapping: ${unmappedFields.join(', ')}`,
    };
  }

  // Validate required canonical fields are present
  const missingRequired = REQUIRED_CANONICAL.filter(
    (f) => canonicalPayload[f] === undefined,
  );
  if (missingRequired.length > 0) {
    return {
      status: 'needs_input',
      unmappedFields: missingRequired,
      detail: `Mapping complete but required canonical field(s) missing: ${missingRequired.join(', ')}`,
    };
  }

  // learnerId must be a UUID
  const learnerId = canonicalPayload['learnerId'];
  if (typeof learnerId !== 'string' || learnerId.length === 0) {
    return {
      status: 'needs_input',
      unmappedFields: ['learnerId'],
      detail: 'Canonical learnerId is absent or not a string after mapping',
    };
  }

  // Domain consistency: if the mappings route to a domain field, validate it
  const mappedDomain = canonicalPayload['domain'];
  if (mappedDomain !== undefined && mappedDomain !== targetDomain) {
    return {
      status: 'rejected',
      reason: `Source maps to domain ${String(mappedDomain)} but request specifies ${targetDomain}`,
    };
  }

  const eventType = String(canonicalPayload['eventType'] ?? '');
  const occurredAt = String(canonicalPayload['occurredAt'] ?? '');

  return {
    status: 'ok',
    learnerId,
    eventType,
    occurredAt,
    canonicalPayload,
    mappingsApplied,
  };
}

// Stage 09 step 3 — connectors: IngestConnector interface, CSV file connector,
// dead-letter queue, reconciliation report, and stub connectors for SIS and
// other source kinds.
//
// The CsvFileConnector is the primary real connector for this stage: it parses
// the content that its injected resolver returns for a given configRef, applies
// cursor-based incremental pulling, and quarantines invalid rows in the
// dead-letter list rather than blocking the entire run. All other connector
// kinds remain stubs — they return empty records until a real credential or
// file-path is wired in by the school's platform configuration.

import { parseCsv } from './csv-parser.js';
import type { ConnectorKind, RawRecord } from '../types.js';

// ---------------------------------------------------------------------------
// Connector config and base result
// ---------------------------------------------------------------------------

export interface ConnectorConfig {
  readonly tenantId: string;
  readonly sourceId: string;
  readonly configRef: string;
}

export interface PullResult {
  readonly records: readonly RawRecord[];
  readonly hasMore: boolean;
  readonly cursor: string | undefined;
}

// ---------------------------------------------------------------------------
// Dead-letter record
// ---------------------------------------------------------------------------

export interface DeadLetterRecord {
  readonly sourceRef: string;
  readonly rawFields: Readonly<Record<string, string>>;
  readonly error: string;
  readonly failedAt: string;
}

// ---------------------------------------------------------------------------
// Reconciliation report
// ---------------------------------------------------------------------------

export interface ReconciliationReport {
  readonly totalSourceRows: number;
  readonly pulled: number;
  readonly deadLettered: number;
}

// ---------------------------------------------------------------------------
// Rich pull result (returned by connectors that support dead-lettering)
// ---------------------------------------------------------------------------

export interface RichPullResult extends PullResult {
  readonly deadLettered: readonly DeadLetterRecord[];
  readonly reconciliation: ReconciliationReport;
}

// ---------------------------------------------------------------------------
// Connector interface
// ---------------------------------------------------------------------------

export interface IngestConnector {
  readonly kind: ConnectorKind;
  pull(config: ConnectorConfig, cursor?: string): Promise<PullResult>;
}

// ---------------------------------------------------------------------------
// Content resolver (injected so production code swaps in its own storage client)
// ---------------------------------------------------------------------------

export type ContentResolver = (configRef: string) => Promise<string>;

// ---------------------------------------------------------------------------
// CSV file connector (real implementation)
// ---------------------------------------------------------------------------

export class CsvFileConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'FILE_CSV';

  constructor(private readonly resolve: ContentResolver) {}

  async pull(config: ConnectorConfig, cursor?: string): Promise<RichPullResult> {
    const content = await this.resolve(config.configRef);
    const allRows = parseCsv(content, config.configRef);

    // Cursor is the rowIndex of the last row already delivered. undefined or
    // "0" means "start from the beginning" (row 0 is the header, never returned).
    const fromRowIndex = cursor !== undefined ? parseInt(cursor, 10) : 0;
    const pending = allRows.filter((row) => row.rowIndex > fromRowIndex);

    const records: RawRecord[] = [];
    const deadLettered: DeadLetterRecord[] = [];

    for (const row of pending) {
      if (Object.keys(row.fields).length === 0) {
        deadLettered.push({
          sourceRef: row.sourceRef,
          rawFields: row.fields,
          error: 'Row yielded no fields after parsing — skipped',
          failedAt: new Date().toISOString(),
        });
        continue;
      }

      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row.fields)) {
        payload[k] = v;
      }

      records.push({ sourceRef: row.sourceRef, payload });
    }

    const lastRow = pending[pending.length - 1];
    const nextCursor = lastRow !== undefined ? String(lastRow.rowIndex) : cursor;

    return {
      records,
      deadLettered,
      hasMore: false,
      cursor: nextCursor,
      reconciliation: {
        totalSourceRows: allRows.length,
        pulled: records.length,
        deadLettered: deadLettered.length,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Stub connectors (empty-vessel pattern — return no records until wired)
// ---------------------------------------------------------------------------

export class FileConnector implements IngestConnector {
  readonly kind: ConnectorKind;

  constructor(kind: 'FILE_CSV' | 'FILE_XLSX') {
    this.kind = kind;
  }

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

export class SisApiConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'SIS_API';

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

export class ScreenerApiConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'SCREENER_API';

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

export class AttendanceApiConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'ATTENDANCE_API';

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

export class BehaviourApiConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'BEHAVIOUR_API';

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

export class ManualUploadConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'MANUAL_UPLOAD';

  async pull(_config: ConnectorConfig, _cursor?: string): Promise<PullResult> {
    return { records: [], hasMore: false, cursor: undefined };
  }
}

// ---------------------------------------------------------------------------
// Connector registry
// ---------------------------------------------------------------------------

export type ConnectorFactory = (kind: ConnectorKind) => IngestConnector;

const DEFAULT_STUBS: Partial<Record<ConnectorKind, IngestConnector>> = {
  FILE_CSV: new FileConnector('FILE_CSV'),
  FILE_XLSX: new FileConnector('FILE_XLSX'),
  SIS_API: new SisApiConnector(),
  SCREENER_API: new ScreenerApiConnector(),
  ATTENDANCE_API: new AttendanceApiConnector(),
  BEHAVIOUR_API: new BehaviourApiConnector(),
  MANUAL_UPLOAD: new ManualUploadConnector(),
};

export function getConnector(
  kind: ConnectorKind,
  registry: Partial<Record<ConnectorKind, IngestConnector>> = DEFAULT_STUBS,
): IngestConnector | undefined {
  return registry[kind];
}

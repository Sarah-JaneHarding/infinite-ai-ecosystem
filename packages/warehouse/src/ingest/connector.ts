// Stage 09 step 1 — IngestConnector interface and the file-connector stub.
//
// Every data source connector implements IngestConnector. Production connectors
// pull from live source systems; the stub returns an empty record set until a
// real file or API credential is wired in — same "empty vessel" pattern as every
// other Stage 09 component in the absence of real school data.

import type { ConnectorKind, RawRecord } from '../types.js';

// ---------------------------------------------------------------------------
// Connector interface
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

export interface IngestConnector {
  readonly kind: ConnectorKind;
  pull(config: ConnectorConfig, cursor?: string): Promise<PullResult>;
}

// ---------------------------------------------------------------------------
// File connector stub (CSV / XLSX)
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

// ---------------------------------------------------------------------------
// SIS API connector stub
// ---------------------------------------------------------------------------

export class SisApiConnector implements IngestConnector {
  readonly kind: ConnectorKind = 'SIS_API';

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
};

export function getConnector(
  kind: ConnectorKind,
  registry: Partial<Record<ConnectorKind, IngestConnector>> = DEFAULT_STUBS,
): IngestConnector | undefined {
  return registry[kind];
}

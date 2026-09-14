'use client';

// CAPS Canon Ingestion Console — React client component.
//
// Displays the 55-document registry (52 CAPS + 3 ATPs) with per-doc status:
//   required → downloaded (localStorage, browser-only) → ingested → ratified → L0
//
// "Downloaded" state (SHA-256 verified) is stored in localStorage per the architecture
// decision: the browser computes the hash via the Web Crypto API; the hash is never
// sent to the server beyond being required as proof-of-verification on the ingest call.
//
// "Ingested" and "ratified" state come from GET /api/caps-canon, which reads the
// Brain write candidate and constitution tables via withTenant.

import { useCallback, useEffect, useRef, useState } from 'react';

import { ALL_CAPS_CANON_DOCS, type CapsCanonDoc } from './caps-canon-docs';
import type {
  CapsCanonDocStatus,
  CapsCanonStatusResponse,
} from '@/app/api/caps-canon/route';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConsoleStatus = 'required' | 'downloaded' | 'ingested' | 'ratified';

interface LocalRecord {
  sha256: string;
  fileName: string;
  fileSizeBytes: number;
  verifiedAt: string;
}

const LOCAL_STORAGE_KEY = 'infiniteAiCapsCanon1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadLocalRecords(): Record<string, LocalRecord> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '{}') as Record<
      string,
      LocalRecord
    >;
  } catch {
    return {};
  }
}

function saveLocalRecords(records: Record<string, LocalRecord>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage not available (private browsing etc.) — silently ignore
  }
}

function computeStatus(
  doc: CapsCanonDoc,
  local: Record<string, LocalRecord>,
  serverStatus: Record<string, CapsCanonDocStatus>,
): ConsoleStatus {
  const server = serverStatus[doc.id];
  if (server?.constitutionRowId) return 'ratified';
  if (
    server?.candidateStatus === 'AWAITING_RATIFICATION' ||
    server?.candidateStatus === 'COMMITTED' ||
    server?.candidateStatus === 'INDEXED'
  )
    return 'ingested';
  if (local[doc.id]?.sha256) return 'downloaded';
  return 'required';
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ConsoleStatus, string> = {
  required: 'REQUIRED',
  downloaded: 'DOWNLOADED',
  ingested: 'INGESTED',
  ratified: 'RATIFIED ✓',
};

const STATUS_CLASSES: Record<ConsoleStatus, string> = {
  required: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  downloaded: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  ingested: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  ratified: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function StatusPill({ status }: { status: ConsoleStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type PhaseFilter = 'all' | 'FP' | 'IP' | 'SP' | 'ATP';

export function CapsCanonConsole() {
  const [localRecords, setLocalRecords] = useState<Record<string, LocalRecord>>({});
  const [serverStatus, setServerStatus] = useState<Record<string, CapsCanonDocStatus>>(
    {},
  );
  const [loadingServer, setLoadingServer] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const [phase, setPhase] = useState<PhaseFilter>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsoleStatus | 'all'>('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Ratifier name input held per-doc
  const [ratifierName, setRatifierName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load localStorage on mount
  useEffect(() => {
    setLocalRecords(loadLocalRecords());
  }, []);

  // Poll server status
  const fetchServerStatus = useCallback(async () => {
    setLoadingServer(true);
    setServerError(null);
    try {
      const res = await fetch('/api/caps-canon', { credentials: 'same-origin' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(data.error ?? `Server error ${res.status}`);
        return;
      }
      const data = (await res.json()) as CapsCanonStatusResponse;
      const byId: Record<string, CapsCanonDocStatus> = {};
      for (const d of data.docs) byId[d.consoleId] = d;
      setServerStatus(byId);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    void fetchServerStatus();
  }, [fetchServerStatus]);

  // Filtered doc list
  const filteredDocs = ALL_CAPS_CANON_DOCS.filter((doc) => {
    if (phase !== 'all' && doc.phase !== phase) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !doc.id.toLowerCase().includes(q) &&
        !doc.title.toLowerCase().includes(q) &&
        !doc.subject.toLowerCase().includes(q) &&
        !doc.lang.toLowerCase().includes(q)
      )
        return false;
    }
    if (statusFilter !== 'all') {
      const st = computeStatus(doc, localRecords, serverStatus);
      if (st !== statusFilter) return false;
    }
    return true;
  });

  // Counts
  const counts = { required: 0, downloaded: 0, ingested: 0, ratified: 0 };
  for (const doc of ALL_CAPS_CANON_DOCS) {
    const st = computeStatus(doc, localRecords, serverStatus);
    counts[st]++;
  }
  const readinessPct = Math.round((counts.ratified / ALL_CAPS_CANON_DOCS.length) * 100);

  const selectedDoc = selectedId
    ? ALL_CAPS_CANON_DOCS.find((d) => d.id === selectedId)
    : null;
  const selectedStatus = selectedDoc
    ? computeStatus(selectedDoc, localRecords, serverStatus)
    : null;
  const selectedLocal = selectedId ? localRecords[selectedId] : undefined;
  const selectedServer = selectedId ? serverStatus[selectedId] : undefined;

  // PDF upload & SHA-256 verification
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const sha256 = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const record: LocalRecord = {
      sha256,
      fileName: file.name,
      fileSizeBytes: file.size,
      verifiedAt: new Date().toISOString(),
    };
    const next = { ...localRecords, [selectedId]: record };
    setLocalRecords(next);
    saveLocalRecords(next);
    // Clear the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Ingest action
  const handleIngest = async () => {
    if (!selectedId || !selectedLocal?.sha256) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/caps-canon/${encodeURIComponent(selectedId)}/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sha256: selectedLocal.sha256 }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? `Ingest failed (${res.status})`);
        return;
      }
      await fetchServerStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  // Ratify action
  const handleRatify = async () => {
    if (!selectedId || !ratifierName.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/caps-canon/${encodeURIComponent(selectedId)}/ratify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            reason: `Verified by ${ratifierName.trim()} against official DBE PDF.`,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? `Ratify failed (${res.status})`);
        return;
      }
      await fetchServerStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Governing rules */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-3">
          Three governing rules
        </p>
        <div className="grid md:grid-cols-3 gap-4 text-xs text-[var(--iai-text-subtle)]">
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3">
            <strong className="text-[var(--iai-text)]">
              Never synthesise curriculum.
            </strong>{' '}
            Documents must be the real DBE PDFs from official sources. If a source is
            missing, stop and ask.
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3">
            <strong className="text-[var(--iai-text)]">
              CAPS is the only source of outcomes.
            </strong>{' '}
            Every topic and weighting must trace to a clause in a ratified document here.
          </div>
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3">
            <strong className="text-[var(--iai-text)]">
              Human ratification before L0.
            </strong>{' '}
            Nothing enters the Constitution tier without a named human approving it. Facts
            are superseded, never destructively updated.
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ['required', counts.required, 'text-gray-500'],
            ['downloaded', counts.downloaded, 'text-sky-600 dark:text-sky-400'],
            ['ingested', counts.ingested, 'text-violet-600 dark:text-violet-400'],
            ['ratified', counts.ratified, 'text-green-700 dark:text-green-400'],
          ] as const
        ).map(([label, count, cls]) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--iai-border)] bg-[var(--iai-surface)] p-4 text-center"
          >
            <p className={`text-2xl font-bold font-[var(--iai-font-title)] ${cls}`}>
              {count}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-[var(--iai-text-subtle)] mt-1">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Readiness bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5 text-[var(--iai-text-subtle)]">
          <span>Canon readiness</span>
          <span className="text-green-700 dark:text-green-400 font-semibold">
            {readinessPct}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--iai-surface-raised)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-700"
            style={{ width: `${readinessPct}%` }}
          />
        </div>
      </div>

      {/* Server status indicator */}
      {loadingServer && (
        <p className="text-xs text-[var(--iai-text-subtle)] animate-pulse">
          Loading Brain status…
        </p>
      )}
      {serverError && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Brain status error: {serverError}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void fetchServerStatus()}
          >
            Retry
          </button>
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', `All (${ALL_CAPS_CANON_DOCS.length})`],
              ['FP', 'Foundation R–3 (14)'],
              ['IP', 'Intermediate 4–6 (17)'],
              ['SP', 'Senior · Gr 7 (21)'],
              ['ATP', 'ATPs (3)'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                phase === p
                  ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-500 dark:bg-cyan-900/20 dark:text-cyan-400'
                  : 'border-[var(--iai-border)] text-[var(--iai-text-subtle)] hover:border-cyan-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search subject, language, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface)] px-3 py-2 text-xs w-52 outline-none focus:border-cyan-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ConsoleStatus | 'all')}
            className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface)] px-3 py-2 text-xs w-40 outline-none focus:border-cyan-400"
          >
            <option value="all">All statuses</option>
            <option value="required">Required</option>
            <option value="downloaded">Downloaded</option>
            <option value="ingested">Ingested</option>
            <option value="ratified">Ratified</option>
          </select>
        </div>
      </div>

      {/* Document grid */}
      {filteredDocs.length === 0 ? (
        <p className="text-center text-sm text-[var(--iai-text-subtle)] py-10">
          No documents match this filter.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredDocs.map((doc) => {
            const st = computeStatus(doc, localRecords, serverStatus);
            const isSelected = selectedId === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setSelectedId(isSelected ? null : doc.id);
                  setActionError(null);
                  setRatifierName('');
                }}
                className={`rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                  isSelected
                    ? 'border-cyan-400 shadow-[0_0_0_1px_theme(colors.cyan.400)]'
                    : 'border-[var(--iai-border)] hover:border-cyan-300'
                } bg-[var(--iai-surface)]`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                    {doc.id}
                  </p>
                  <StatusPill status={st} />
                </div>
                <h4 className="font-bold text-sm mt-2 leading-snug text-[var(--iai-text)]">
                  {doc.title}
                </h4>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    doc.phase === 'ATP'
                      ? 'ATP'
                      : doc.phase === 'FP'
                        ? 'Foundation'
                        : doc.phase === 'IP'
                          ? 'Intermediate'
                          : 'Senior',
                    `Gr ${doc.grades}`,
                    doc.subject,
                    doc.lang,
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[var(--iai-border)] px-2 py-0.5 text-[10px] text-[var(--iai-text-subtle)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] mt-3 text-cyan-600 dark:text-cyan-400">
                  {isSelected ? 'Close workflow ▴' : 'Open workflow ▾'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedDoc && selectedStatus !== null && (
        <div className="rounded-xl border border-cyan-300 dark:border-cyan-700 bg-[var(--iai-surface)] p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-5">
              <div>
                <p className="font-mono text-xs text-amber-600 dark:text-amber-400">
                  {selectedDoc.id} · {selectedDoc.group}
                </p>
                <h3 className="text-xl font-bold text-[var(--iai-text)] mt-1">
                  {selectedDoc.title}
                </h3>
              </div>

              <div className="grid md:grid-cols-3 gap-5">
                {/* Metadata */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-2">
                    Metadata
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {[
                      [
                        'Phase',
                        selectedDoc.phase === 'ATP' ? 'ATP calendar' : selectedDoc.phase,
                      ],
                      ['Grades', selectedDoc.grades],
                      ['Subject', selectedDoc.subject],
                      ['Language', selectedDoc.lang],
                    ].map(([k, v]) => (
                      <li
                        key={k}
                        className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface-raised)] px-2.5 py-2 text-[var(--iai-text-subtle)]"
                      >
                        {k}: <strong className="text-[var(--iai-text)]">{v}</strong>
                      </li>
                    ))}
                    <li className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface-raised)] px-2.5 py-2">
                      Status: <StatusPill status={selectedStatus} />
                    </li>
                    {selectedDoc.brainDocumentId && (
                      <li className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface-raised)] px-2.5 py-2 font-mono text-[10px] text-[var(--iai-text-subtle)] break-all">
                        Brain ID: {selectedDoc.brainDocumentId}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Step 1–2: Source & Verify */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-2">
                    Step 1–2 · Source &amp; Verify
                  </p>
                  <div className="flex flex-col gap-2">
                    <a
                      href={selectedDoc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--iai-border)] px-4 py-2 text-xs font-semibold text-[var(--iai-text)] hover:border-cyan-400 transition-colors"
                    >
                      Open official DBE source ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                      {selectedLocal ? '↺ Re-upload PDF' : '⬆ Upload downloaded PDF'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => void handleFileSelect(e)}
                    />
                    {selectedLocal ? (
                      <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-900/10 p-3 text-xs text-sky-700 dark:text-sky-400">
                        <p className="font-semibold">{selectedLocal.fileName}</p>
                        <p className="text-[10px] mt-0.5 text-[var(--iai-text-subtle)]">
                          {formatFileSize(selectedLocal.fileSizeBytes)}
                        </p>
                        <p className="font-mono text-[10px] mt-1 break-all text-[var(--iai-text-subtle)]">
                          SHA-256: {selectedLocal.sha256}
                        </p>
                        <p className="text-[10px] mt-0.5 text-[var(--iai-text-subtle)]">
                          Verified {new Date(selectedLocal.verifiedAt).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-[var(--iai-border)] p-3 text-xs text-[var(--iai-text-subtle)]">
                        No file verified yet. Download from the official source, then
                        upload the PDF here to compute its SHA-256 fingerprint.
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 3–4: Ingest & Ratify */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-2">
                    Step 3–4 · Ingest &amp; Ratify
                  </p>
                  <div className="flex flex-col gap-2">
                    {selectedDoc.brainDocumentId === null ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                        Ingest disabled — no structured data for this document yet. CE-01
                        PDF processing will handle it once the consolidated PDF is
                        verified.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleIngest()}
                          disabled={
                            actionLoading ||
                            !selectedLocal?.sha256 ||
                            selectedStatus === 'ingested' ||
                            selectedStatus === 'ratified'
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--iai-border)] px-4 py-2 text-xs font-semibold text-[var(--iai-text)] hover:border-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            !selectedLocal?.sha256
                              ? 'Upload and verify a PDF first'
                              : selectedStatus === 'ingested'
                                ? 'Already ingested'
                                : selectedStatus === 'ratified'
                                  ? 'Already ratified'
                                  : 'Submit to Brain write path'
                          }
                        >
                          🧠 Mark ingested → CE-01 parse queue
                        </button>
                        <input
                          type="text"
                          placeholder="Ratifier name (e.g. HoD, principal)"
                          value={ratifierName}
                          onChange={(e) => setRatifierName(e.target.value)}
                          className="rounded-lg border border-[var(--iai-border)] bg-[var(--iai-surface)] px-3 py-2 text-xs outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => void handleRatify()}
                          disabled={
                            actionLoading ||
                            !ratifierName.trim() ||
                            selectedStatus !== 'ingested'
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-green-300 dark:border-green-700 px-4 py-2 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            selectedStatus !== 'ingested'
                              ? 'Ingest the document first'
                              : !ratifierName.trim()
                                ? 'Enter a ratifier name'
                                : 'Ratify and publish to L0 Constitution'
                          }
                        >
                          🔏 Ratify → publish to L0
                        </button>
                        {selectedServer?.ratifiedBy && (
                          <p className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10 p-3 text-xs text-green-700 dark:text-green-400">
                            🔏 Ratified by <strong>{selectedServer.ratifiedBy}</strong>
                            {selectedServer.ratifiedAt &&
                              ` on ${new Date(selectedServer.ratifiedAt).toLocaleString()}`}{' '}
                            — eligible for L0 Constitution.
                          </p>
                        )}
                      </>
                    )}
                    {actionError && (
                      <p className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10 p-3 text-xs text-red-700 dark:text-red-400">
                        {actionError}
                      </p>
                    )}
                    {actionLoading && (
                      <p className="text-xs text-[var(--iai-text-subtle)] animate-pulse">
                        Working…
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[var(--iai-text-subtle)]">
                Provenance: content parsing (topic graph, weightings, cognitive levels)
                runs inside CE-01 CAPS Mapper against the ratified PDF hash — this console
                stores metadata and status only and never invents curriculum.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-full border border-[var(--iai-border)] px-3 py-1.5 text-xs font-semibold text-[var(--iai-text-subtle)] hover:border-[var(--iai-text)] transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

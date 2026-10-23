'use client';

import { useState } from 'react';
import { StatusPill } from '@infinite-ai/design-system';
import { describeValue, type ApprovalView } from '@/lib/approvals';

interface Props {
  readonly approval: ApprovalView;
}

type Outcome = 'APPROVED' | 'REJECTED' | 'EDITED';
type UIState = 'pending' | 'submitting' | 'done' | 'error';

export function ApprovalDetail({ approval }: Props) {
  const { id, runId } = approval;
  const [uiState, setUiState] = useState<UIState>('pending');
  const [confirmedOutcome, setConfirmedOutcome] = useState<Outcome | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function submitDecision(outcome: Outcome) {
    if (reason.length === 0) return;
    setUiState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, outcome, reason }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setConfirmedOutcome(outcome);
      setUiState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error');
      setUiState('error');
    }
  }

  if (uiState === 'done' && confirmedOutcome !== null) {
    const approved = confirmedOutcome === 'APPROVED';
    return (
      <section aria-labelledby="approval-result-heading">
        <div
          role="status"
          aria-live="polite"
          className={`p-6 rounded-[var(--iai-radius-xl)] border ${approved ? 'bg-[var(--iai-success-bg)] border-[var(--iai-success-border)] text-[var(--iai-success-text)]' : 'bg-[var(--iai-error-bg)] border-[var(--iai-error-border)] text-[var(--iai-error-text)]'}`}
        >
          <h1 id="approval-result-heading" className="font-semibold text-lg">
            {approved
              ? 'Artefact approved.'
              : confirmedOutcome === 'EDITED'
                ? 'Edit recorded.'
                : 'Artefact rejected.'}
          </h1>
          {reason && <p className="text-sm mt-1">Reason: {reason}</p>}
          <a href="/approvals" className="mt-3 inline-block text-sm underline">
            Back to approvals
          </a>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="approval-heading">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <p
            className="text-xs text-[var(--iai-text-subtle)]"
            style={{ fontFamily: 'var(--iai-font-mono)' }}
          >
            {id}
          </p>
          <h1
            id="approval-heading"
            className="text-2xl font-bold text-[var(--iai-text)] mt-0.5"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Step: {approval.stepId}
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            Awaiting a decision from: {approval.requiredRole} · opened{' '}
            {approval.openedAt.slice(0, 16).replace('T', ' ')} UTC
          </p>
        </div>
        <StatusPill status="pending" />
      </div>

      {/* Evidence */}
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)] mb-1">
          Evidence
        </h2>
        <pre className="text-xs text-[var(--iai-text)] whitespace-pre-wrap p-3 rounded-[var(--iai-radius-md)] bg-[var(--iai-bg-subtle)] border border-[var(--iai-border)]">
          {describeValue(approval.evidence)}
        </pre>
      </div>

      {/* Diff against previous */}
      <div className="mb-4 p-3 rounded-[var(--iai-radius-md)] bg-[var(--iai-bg-subtle)] border border-[var(--iai-border)] text-xs text-[var(--iai-text-subtle)]">
        <strong>Change from previous:</strong>{' '}
        {approval.diffAgainstPrevious === null ? (
          'none — there is no earlier version.'
        ) : (
          <pre className="mt-1 whitespace-pre-wrap">
            {describeValue(approval.diffAgainstPrevious)}
          </pre>
        )}
      </div>

      {/* Artefact content */}
      <article
        aria-label="Artefact content"
        className="mb-6 p-5 rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-sm)]"
      >
        <pre className="text-sm text-[var(--iai-text)] whitespace-pre-wrap leading-relaxed font-sans">
          {describeValue(approval.artefact)}
        </pre>
      </article>

      {/* Error banner */}
      {uiState === 'error' && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-[var(--iai-radius-md)] bg-[var(--iai-error-bg)] border border-[var(--iai-error-border)] text-[var(--iai-error-text)] text-sm"
        >
          {errorMsg}
        </div>
      )}

      {/* The page only renders for the role the gate is waiting on; the server still checks
          the actor's own role assignment when the decision is recorded. */}
      <div className="rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] p-5">
        <h2 className="text-sm font-semibold text-[var(--iai-text)] mb-3">
          Your decision
        </h2>
        <label
          htmlFor="reason"
          className="block text-xs text-[var(--iai-text-subtle)] mb-1"
        >
          Reason (required)
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={uiState === 'submitting'}
          className="w-full text-sm border border-[var(--iai-border)] rounded-[var(--iai-radius-md)] p-2.5 bg-[var(--iai-bg-subtle)] text-[var(--iai-text)] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iai-primary)] disabled:opacity-60"
          placeholder="Notes or reason for your decision…"
        />
        <div className="flex gap-3 mt-4 flex-wrap">
          <button
            type="button"
            onClick={() => void submitDecision('APPROVED')}
            disabled={!reason || uiState === 'submitting'}
            className="px-4 py-2 rounded-[var(--iai-radius-md)] bg-[var(--iai-green)] text-white text-sm font-medium hover:bg-[var(--iai-green-deep)] transition-colors disabled:opacity-50"
          >
            {uiState === 'submitting' ? 'Saving…' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => void submitDecision('EDITED')}
            disabled={!reason || uiState === 'submitting'}
            className="px-4 py-2 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] text-[var(--iai-text)] text-sm font-medium hover:bg-[var(--iai-bg-subtle)] transition-colors disabled:opacity-50"
          >
            Edit &amp; approve
          </button>
          <button
            type="button"
            onClick={() => void submitDecision('REJECTED')}
            disabled={!reason || uiState === 'submitting'}
            className="px-4 py-2 rounded-[var(--iai-radius-md)] text-[var(--iai-red)] text-sm font-medium hover:bg-[var(--iai-error-bg)] transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
        <p className="text-xs text-[var(--iai-text-subtle)] mt-2">
          A reason is required. The record is append-only and cannot be undone.
        </p>
      </div>
    </section>
  );
}

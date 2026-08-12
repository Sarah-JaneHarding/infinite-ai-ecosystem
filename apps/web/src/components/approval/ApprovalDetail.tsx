'use client';

import { useState } from 'react';
import { StatusPill } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';
import type { Role } from '@infinite-ai/policy';

interface Props {
  readonly id: string;
  readonly role: Role;
}

type Decision = 'approved' | 'rejected' | null;

const MOCK_ARTEFACT = {
  type: 'Lesson plan',
  subject: 'Mathematics Gr 8',
  topic: 'Solving linear equations',
  agent: 'TB-01 v7',
  author: 'Ms Nkosi',
  content: `
## Learning objectives
By the end of this lesson, learners will be able to:
1. Identify linear equations in one variable.
2. Apply the balance method to isolate the variable.
3. Verify their answer by substitution.

## Lesson outline (60 min)
- 0–5 min: Recap — what is an equation? (Think-Pair-Share)
- 5–20 min: The balance model — demonstration with physical manipulatives
- 20–40 min: Three worked examples, increasing in complexity
- 40–50 min: Independent practice — 5 problems
- 50–60 min: Exit ticket (2 questions)
  `.trim(),
  evidence: ['Learner progress data (de-identified)', 'ATP sequence node: Equations-01'],
  previousVersion: 'v6 — lacked worked examples for negative coefficients.',
};

export function ApprovalDetail({ id, role }: Props) {
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState('');

  const canDecide = ['hod', 'smt', 'admin'].includes(role);

  if (decision) {
    return (
      <section aria-labelledby="approval-result-heading">
        <div
          role="status"
          aria-live="polite"
          className={`p-6 rounded-[var(--iai-radius-xl)] border ${decision === 'approved' ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]' : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'}`}
        >
          <h1 id="approval-result-heading" className="font-semibold text-lg">
            {decision === 'approved' ? 'Artefact approved.' : 'Artefact rejected.'}
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
            {MOCK_ARTEFACT.topic}
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            {MOCK_ARTEFACT.type} · {MOCK_ARTEFACT.subject} · by {MOCK_ARTEFACT.author}
          </p>
        </div>
        <StatusPill status="pending" />
      </div>

      {/* Agent + evidence */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant="info">{MOCK_ARTEFACT.agent}</Badge>
        {MOCK_ARTEFACT.evidence.map((e) => (
          <Badge key={e} variant="default">
            {e}
          </Badge>
        ))}
      </div>

      {/* Diff against previous */}
      <div className="mb-4 p-3 rounded-[var(--iai-radius-md)] bg-[var(--iai-bg-subtle)] border border-[var(--iai-border)] text-xs text-[var(--iai-text-subtle)]">
        <strong>Change from previous:</strong> {MOCK_ARTEFACT.previousVersion}
      </div>

      {/* Artefact content */}
      <article
        aria-label="Artefact content"
        className="mb-6 p-5 rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-sm)]"
      >
        <pre className="text-sm text-[var(--iai-text)] whitespace-pre-wrap leading-relaxed font-sans">
          {MOCK_ARTEFACT.content}
        </pre>
      </article>

      {/* Decision UI — only for roles that can approve */}
      {canDecide ? (
        <div className="rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--iai-text)] mb-3">
            Your decision
          </h2>
          <label
            htmlFor="reason"
            className="block text-xs text-[var(--iai-text-subtle)] mb-1"
          >
            Reason (required for rejection)
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full text-sm border border-[var(--iai-border)] rounded-[var(--iai-radius-md)] p-2.5 bg-[var(--iai-bg-subtle)] text-[var(--iai-text)] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iai-primary)]"
            placeholder="Optional notes…"
          />
          <div className="flex gap-3 mt-4 flex-wrap">
            <button
              type="button"
              onClick={() => setDecision('approved')}
              className="px-4 py-2 rounded-[var(--iai-radius-md)] bg-[var(--iai-green)] text-white text-sm font-medium hover:bg-[var(--iai-green-deep)] transition-colors"
            >
              Approve
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] text-[var(--iai-text)] text-sm font-medium hover:bg-[var(--iai-bg-subtle)] transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (!reason) {
                  return;
                }
                setDecision('rejected');
              }}
              disabled={!reason}
              className="px-4 py-2 rounded-[var(--iai-radius-md)] text-[var(--iai-red)] text-sm font-medium hover:bg-[#fee2e2] transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          <p className="text-xs text-[var(--iai-text-subtle)] mt-2">
            A reason is required to reject. The record is append-only and cannot be
            undone.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--iai-text-subtle)] italic">
          You can view this artefact but do not have permission to approve or reject it.
        </p>
      )}
    </section>
  );
}

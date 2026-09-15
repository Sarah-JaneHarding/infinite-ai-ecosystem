import type { ReactNode } from 'react';

export type PillStatus = 'pending' | 'approved' | 'rejected' | 'draft' | 'live';

export interface StatusPillProps {
  readonly status: PillStatus;
  readonly className?: string;
}

const LABELS: Record<PillStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  draft: 'Draft',
  live: 'Live',
};

const STYLES: Record<PillStatus, string> = {
  pending:
    'bg-[var(--iai-warning-bg)] text-[var(--iai-warning-text)] border-[var(--iai-warning-border)]',
  approved:
    'bg-[var(--iai-success-bg)] text-[var(--iai-success-text)] border-[var(--iai-success-border)]',
  rejected:
    'bg-[var(--iai-error-bg)] text-[var(--iai-error-text)] border-[var(--iai-error-border)]',
  draft:
    'bg-[var(--iai-bg-subtle)] text-[var(--iai-text-subtle)] border-[var(--iai-border)]',
  live: 'bg-[var(--iai-info-bg)] text-[var(--iai-info-text)] border-[var(--iai-info-border)]',
};

const DOTS: Record<PillStatus, string> = {
  pending: 'bg-[var(--iai-warning-dot)]',
  approved: 'bg-[var(--iai-success-dot)]',
  rejected: 'bg-[var(--iai-error-dot)]',
  draft: 'bg-[var(--iai-text-subtle)]',
  live: 'bg-[var(--iai-info-dot)]',
};

export function StatusPill({ status, className = '' }: StatusPillProps): ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STYLES[status]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${DOTS[status]}`} aria-hidden />
      {LABELS[status]}
    </span>
  );
}

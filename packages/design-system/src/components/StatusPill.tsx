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
  pending: 'bg-[#fef9c3] text-[#854d0e] border-[#fef08a]',
  approved: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  rejected: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
  draft:
    'bg-[var(--iai-bg-subtle)] text-[var(--iai-text-subtle)] border-[var(--iai-border)]',
  live: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]',
};

const DOTS: Record<PillStatus, string> = {
  pending: 'bg-[#ca8a04]',
  approved: 'bg-[#16a34a]',
  rejected: 'bg-[#dc2626]',
  draft: 'bg-[var(--iai-text-subtle)]',
  live: 'bg-[#2563eb]',
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

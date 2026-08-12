import type { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  readonly variant?: BadgeVariant;
  readonly children: ReactNode;
  readonly className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--iai-bg-subtle)] text-[var(--iai-text-subtle)] border-[var(--iai-border)]',
  success: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  warning: 'bg-[#fef9c3] text-[#854d0e] border-[#fef08a]',
  error: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
  info: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

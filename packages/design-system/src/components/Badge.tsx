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
  success:
    'bg-[var(--iai-success-bg)] text-[var(--iai-success-text)] border-[var(--iai-success-border)]',
  warning:
    'bg-[var(--iai-warning-bg)] text-[var(--iai-warning-text)] border-[var(--iai-warning-border)]',
  error:
    'bg-[var(--iai-error-bg)] text-[var(--iai-error-text)] border-[var(--iai-error-border)]',
  info: 'bg-[var(--iai-info-bg)] text-[var(--iai-info-text)] border-[var(--iai-info-border)]',
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

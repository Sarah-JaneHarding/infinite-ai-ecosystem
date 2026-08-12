'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center font-medium rounded-[var(--iai-radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--iai-primary)] text-[var(--iai-primary-text)] hover:bg-[var(--iai-primary-deep)] focus-visible:ring-[var(--iai-primary)]',
  secondary:
    'border border-[var(--iai-border)] bg-[var(--iai-bg)] text-[var(--iai-text)] hover:bg-[var(--iai-bg-subtle)] focus-visible:ring-[var(--iai-primary)]',
  ghost:
    'bg-transparent text-[var(--iai-text)] hover:bg-[var(--iai-bg-subtle)] focus-visible:ring-[var(--iai-primary)]',
  destructive:
    'bg-[var(--iai-red)] text-white hover:bg-[var(--iai-red-deep)] focus-visible:ring-[var(--iai-red)]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

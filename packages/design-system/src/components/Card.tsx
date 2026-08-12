import type { ReactNode } from 'react';

export type CardHue =
  'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'indigo' | 'violet';

export interface ModularCardProps {
  readonly hue?: CardHue;
  readonly eyebrow?: string;
  readonly title: string;
  readonly emoji?: string;
  readonly status?: string;
  readonly duration?: string;
  readonly cta?: string;
  readonly onCtaClick?: () => void;
  readonly children?: ReactNode;
  readonly className?: string;
}

const HUE_GRADIENTS: Record<CardHue, string> = {
  red: 'from-[#e4483f] to-[#b11d15]',
  orange: 'from-[#f2811f] to-[#b45706]',
  amber: 'from-[#f5b400] to-[#a77a00]',
  green: 'from-[#2fae66] to-[#1e7845]',
  teal: 'from-[#159e94] to-[#0c6e67]',
  blue: 'from-[#1565c0] to-[#0d47a1]',
  indigo: 'from-[#4a4fc4] to-[#2b2f8d]',
  violet: 'from-[#7b2fbe] to-[#5c1fa3]',
};

export function ModularCard({
  hue = 'blue',
  eyebrow,
  title,
  emoji,
  status,
  duration,
  cta,
  onCtaClick,
  children,
  className = '',
}: ModularCardProps) {
  return (
    <article
      className={`iai-card-lift rounded-[var(--iai-radius-xl)] overflow-hidden bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-md)] ${className}`}
    >
      {/* 135° gradient header */}
      <div
        className={`bg-gradient-to-br ${HUE_GRADIENTS[hue]} p-[var(--iai-space-9)] text-white`}
      >
        {eyebrow && (
          <p
            className="uppercase tracking-widest text-xs opacity-80 mb-1"
            style={{ fontFamily: 'var(--iai-font-mono)' }}
          >
            {eyebrow}
          </p>
        )}
        <div className="flex items-start gap-3">
          {emoji && (
            <span className="text-3xl leading-none" role="img" aria-hidden>
              {emoji}
            </span>
          )}
          <h2
            className="text-xl font-bold leading-tight"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            {title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="p-[var(--iai-space-9)]">
        {(status ?? duration) && (
          <div className="flex items-center justify-between mb-[var(--iai-space-8)]">
            {status && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--iai-bg-subtle)] text-[var(--iai-text-subtle)] border border-[var(--iai-border)]">
                {status}
              </span>
            )}
            {duration && (
              <span
                className="text-xs text-[var(--iai-text-subtle)]"
                style={{ fontFamily: 'var(--iai-font-mono)' }}
              >
                {duration}
              </span>
            )}
          </div>
        )}
        {children}
        {cta && (
          <button
            onClick={onCtaClick}
            className="mt-[var(--iai-space-8)] w-full py-2.5 rounded-[var(--iai-radius-md)] text-sm font-medium text-[var(--iai-primary)] border border-[var(--iai-primary)] hover:bg-[var(--iai-primary)] hover:text-white transition-colors"
          >
            {cta}
          </button>
        )}
      </div>
    </article>
  );
}

export interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-sm)] p-[var(--iai-space-9)] ${className}`}
    >
      {children}
    </div>
  );
}

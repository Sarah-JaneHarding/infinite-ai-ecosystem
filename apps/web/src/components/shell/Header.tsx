'use client';

import { signOut } from 'next-auth/react';
import { InfinityMark } from '@infinite-ai/design-system';
import { ROLE_LABEL } from '@/lib/roles';
import type { Role } from '@infinite-ai/policy';

export interface HeaderProps {
  readonly role: Role;
  readonly tenantName: string;
  readonly userName: string;
  readonly approvalCount?: number;
}

export function Header({ role, tenantName, userName, approvalCount = 0 }: HeaderProps) {
  return (
    <header
      className="h-14 border-b border-[var(--iai-border)] bg-[var(--iai-bg)] flex items-center justify-between px-4 shrink-0"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <InfinityMark size={32} />
        <div>
          <span
            className="block text-sm font-bold text-[var(--iai-text)] leading-none"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            INFINITE-AI
          </span>
          <span className="block text-xs text-[var(--iai-text-subtle)] leading-none mt-0.5">
            {tenantName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {approvalCount > 0 && (
          <a
            href="/approvals"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--iai-amber)] text-[#854d0e]"
            aria-label={`${approvalCount} pending approval${approvalCount === 1 ? '' : 's'}`}
          >
            <span aria-hidden>⏳</span>
            {approvalCount}
          </a>
        )}
        <div className="text-right">
          <p className="text-xs font-medium text-[var(--iai-text)] leading-none">
            {userName}
          </p>
          <p className="text-[10px] text-[var(--iai-text-subtle)] leading-none mt-0.5">
            {ROLE_LABEL[role]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: '/sign-in' })}
          className="text-xs text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)] transition-colors"
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

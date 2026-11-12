'use client';

import { useState } from 'react';

import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';

import { ROLE_LABEL } from '@/lib/roles';

import { readFailure } from './StaffActionButton';

export interface GrantRoleFormViewProps {
  readonly role: string;
  readonly busy: boolean;
  readonly notice: { readonly kind: 'ok' | 'error'; readonly text: string } | null;
  readonly onRole: (role: string) => void;
  readonly onSubmit: () => void;
}

/** Presentational (no hooks): pick one role and give it. */
export function GrantRoleFormView({
  role,
  busy,
  notice,
  onRole,
  onSubmit,
}: GrantRoleFormViewProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-1"
    >
      <span className="flex gap-2 items-center">
        <select
          aria-label="Role to give"
          value={role}
          disabled={busy}
          onChange={(e) => onRole(e.target.value)}
          className="rounded-md border border-[var(--iai-border)] px-2 py-1 text-sm"
        >
          <option value="">Give a role…</option>
          {SCHOOL_STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || role === ''}
          className="text-sm underline text-[var(--iai-primary)] disabled:opacity-60"
        >
          {busy ? 'Giving…' : 'Give'}
        </button>
      </span>
      {notice !== null && (
        <span
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={
            notice.kind === 'error'
              ? 'text-xs text-[var(--iai-error-text)]'
              : 'text-xs text-[var(--iai-text)]'
          }
        >
          {notice.text}
        </span>
      )}
    </form>
  );
}

const OK_TEXT: Readonly<Record<string, string>> = {
  granted: 'Done.',
  requested: 'Requested. A second administrator must confirm it.',
  applied:
    'Done. You are this school’s only administrator, so no second person was needed.',
};

export function GrantRoleForm({ accountId }: { readonly accountId: string }) {
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<GrantRoleFormViewProps['notice']>(null);

  const submit = (): void => {
    setBusy(true);
    setNotice(null);
    fetch(`/api/admin/staff/accounts/${encodeURIComponent(accountId)}/roles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roles: [role] }),
    })
      .then(async (response) => {
        if (!response.ok) {
          setNotice({ kind: 'error', text: await readFailure(response) });
          return;
        }
        const data: unknown = await response.json().catch(() => null);
        const outcome = (data as { outcome?: unknown } | null)?.outcome;
        setNotice({
          kind: 'ok',
          text: (typeof outcome === 'string' ? OK_TEXT[outcome] : undefined) ?? 'Done.',
        });
        setRole('');
        window.location.reload();
      })
      .catch(() =>
        setNotice({ kind: 'error', text: 'Could not reach the server. Try again.' }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <GrantRoleFormView
      role={role}
      busy={busy}
      notice={notice}
      onRole={setRole}
      onSubmit={submit}
    />
  );
}

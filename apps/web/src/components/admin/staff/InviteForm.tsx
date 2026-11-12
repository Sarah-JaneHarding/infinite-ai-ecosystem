'use client';

import { useState } from 'react';

import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';

import { ROLE_LABEL } from '@/lib/roles';

export interface InviteFormViewProps {
  readonly email: string;
  readonly roles: readonly string[];
  readonly busy: boolean;
  /** What happened last: a success to show, or a refusal's own words. */
  readonly notice: { readonly kind: 'ok' | 'error'; readonly text: string } | null;
  readonly onEmail: (email: string) => void;
  readonly onToggleRole: (role: string) => void;
  readonly onSubmit: () => void;
}

/** The invitation form. Presentational (no hooks), so it renders in a unit test. */
export function InviteFormView(props: InviteFormViewProps) {
  const { email, roles, busy, notice } = props;
  return (
    <form
      aria-labelledby="invite-heading"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
      className="rounded-lg border border-[var(--iai-border)] p-4 flex flex-col gap-4"
    >
      <h2 id="invite-heading" className="text-lg font-semibold">
        Invite someone
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email address</span>
        <input
          type="email"
          name="email"
          autoComplete="off"
          required
          maxLength={254}
          value={email}
          disabled={busy}
          onChange={(e) => props.onEmail(e.target.value)}
          className="rounded-md border border-[var(--iai-border)] px-3 py-2"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium mb-1">Roles</legend>
        {SCHOOL_STAFF_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              disabled={busy}
              onChange={() => props.onToggleRole(role)}
            />
            {ROLE_LABEL[role]}
          </label>
        ))}
      </fieldset>
      {notice !== null && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={
            notice.kind === 'error'
              ? 'text-sm text-[var(--iai-error-text)]'
              : 'text-sm text-[var(--iai-text)]'
          }
        >
          {notice.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || roles.length === 0}
        className="self-start py-2 px-4 rounded-[var(--iai-radius-md)] bg-[var(--iai-primary)] text-white text-sm font-medium disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  );
}

/** What the server said, in words. The server's own refusal text is used as given. */
async function readOutcome(
  response: Response,
): Promise<{ kind: 'ok' | 'error'; text: string }> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // An unreadable body falls through to the generic message below.
  }
  const record = (typeof data === 'object' && data !== null ? data : {}) as Record<
    string,
    unknown
  >;
  if (response.ok) {
    return {
      kind: 'ok',
      text:
        record['confirmation'] === 'AWAITING'
          ? 'Invitation created. A second administrator must confirm it before the person can sign in.'
          : 'Invitation created. The person can sign in with that address.',
    };
  }
  return {
    kind: 'error',
    text:
      typeof record['error'] === 'string' ? record['error'] : 'That could not be done.',
  };
}

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<InviteFormViewProps['notice']>(null);

  const submit = (): void => {
    setBusy(true);
    setNotice(null);
    fetch('/api/admin/staff/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, roles }),
    })
      .then(readOutcome)
      .then((outcome) => {
        setNotice(outcome);
        if (outcome.kind === 'ok') {
          setEmail('');
          setRoles([]);
          // The list above is rendered on the server; reload it so the new invitation shows.
          window.location.reload();
        }
      })
      .catch(() =>
        setNotice({ kind: 'error', text: 'Could not reach the server. Try again.' }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <InviteFormView
      email={email}
      roles={roles}
      busy={busy}
      notice={notice}
      onEmail={setEmail}
      onToggleRole={(role) =>
        setRoles((current) =>
          current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
        )
      }
      onSubmit={submit}
    />
  );
}

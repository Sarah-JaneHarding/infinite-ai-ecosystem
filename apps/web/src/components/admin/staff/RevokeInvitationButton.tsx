'use client';

import { useState } from 'react';

export interface RevokeButtonViewProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onClick: () => void;
}

/** Presentational (no hooks): one button, and the reason when it did not work. */
export function RevokeButtonView({ busy, error, onClick }: RevokeButtonViewProps) {
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="self-start text-sm underline text-[var(--iai-error-text)] disabled:opacity-60"
      >
        {busy ? 'Revoking…' : 'Revoke'}
      </button>
      {error !== null && (
        <span role="alert" className="text-xs text-[var(--iai-error-text)]">
          {error}
        </span>
      )}
    </span>
  );
}

export function RevokeInvitationButton({
  invitationId,
}: {
  readonly invitationId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = (): void => {
    setBusy(true);
    setError(null);
    fetch(`/api/admin/staff/invitations/${encodeURIComponent(invitationId)}/revoke`, {
      method: 'POST',
    })
      .then(async (response) => {
        if (response.ok) {
          window.location.reload();
          return;
        }
        let message = 'That could not be done.';
        try {
          const data: unknown = await response.json();
          const text = (data as { error?: unknown } | null)?.error;
          if (typeof text === 'string') message = text;
        } catch {
          // keep the generic message
        }
        setError(message);
        setBusy(false);
      })
      .catch(() => {
        setError('Could not reach the server. Try again.');
        setBusy(false);
      });
  };

  return <RevokeButtonView busy={busy} error={error} onClick={revoke} />;
}

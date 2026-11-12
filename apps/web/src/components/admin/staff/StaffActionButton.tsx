'use client';

import { useState } from 'react';

export interface ActionButtonViewProps {
  readonly label: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly error: string | null;
  /** `danger` is for acts that take authority away or refuse someone. */
  readonly tone?: 'neutral' | 'danger';
  readonly onClick: () => void;
}

/** Presentational (no hooks): one button, and the reason when it did not work. */
export function ActionButtonView({
  label,
  busyLabel,
  busy,
  error,
  tone = 'neutral',
  onClick,
}: ActionButtonViewProps) {
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className={`self-start text-sm underline disabled:opacity-60 ${
          tone === 'danger' ? 'text-[var(--iai-error-text)]' : 'text-[var(--iai-primary)]'
        }`}
      >
        {busy ? busyLabel : label}
      </button>
      {error !== null && (
        <span role="alert" className="text-xs text-[var(--iai-error-text)]">
          {error}
        </span>
      )}
    </span>
  );
}

export interface StaffActionButtonProps {
  readonly label: string;
  readonly busyLabel: string;
  /** A same-origin API path under /api/admin/staff. */
  readonly url: string;
  /** Sent as JSON when present. */
  readonly body?: Readonly<Record<string, unknown>>;
  readonly tone?: 'neutral' | 'danger';
  /** Asked first, for an act that is hard to take back. */
  readonly confirmText?: string;
}

/** Reads the server's own words for a refusal; a generic line when there are none. */
export async function readFailure(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    const text = (data as { error?: unknown } | null)?.error;
    if (typeof text === 'string') return text;
  } catch {
    // fall through to the generic line
  }
  return 'That could not be done.';
}

export function StaffActionButton(props: StaffActionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (): void => {
    if (props.confirmText !== undefined && !window.confirm(props.confirmText)) return;
    setBusy(true);
    setError(null);
    fetch(props.url, {
      method: 'POST',
      ...(props.body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(props.body),
          }),
    })
      .then(async (response) => {
        if (response.ok) {
          // The lists are rendered on the server; reload so they show what changed.
          window.location.reload();
          return;
        }
        setError(await readFailure(response));
        setBusy(false);
      })
      .catch(() => {
        setError('Could not reach the server. Try again.');
        setBusy(false);
      });
  };

  return (
    <ActionButtonView
      label={props.label}
      busyLabel={props.busyLabel}
      busy={busy}
      error={error}
      {...(props.tone === undefined ? {} : { tone: props.tone })}
      onClick={run}
    />
  );
}

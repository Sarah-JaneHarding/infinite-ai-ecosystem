'use client';

import { useId, useRef, useState } from 'react';
import type { AssistantChatResponse, AssistantProvider } from '@infinite-ai/contracts';

interface Props {
  /** The assistants this school can use now; empty when none is configured. */
  readonly assistants: readonly {
    readonly id: AssistantProvider;
    readonly label: string;
  }[];
}

interface Turn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** The contract's limit on one conversation (`AssistantChatRequest`). */
const MAX_TURNS = 40;

function describeRedactions(redactions: AssistantChatResponse['redactions']): string {
  return redactions
    .map((r) => `${r.count} × ${r.kind.toLowerCase().replace(/_/g, ' ')}`)
    .join(', ');
}

// Nothing here is stored. The conversation lives in this component's state and is gone when
// the page closes: a staff member's questions about their class are not a record the platform
// keeps (the audit trail holds counts, never text).
export function AssistantChat({ assistants }: Props) {
  const [provider, setProvider] = useState<AssistantProvider | null>(
    assistants[0]?.id ?? null,
  );
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (assistants.length === 0 || provider === null) {
    return (
      <section aria-labelledby="assistant-heading">
        <h1
          id="assistant-heading"
          className="text-2xl font-bold text-[var(--iai-text)] mb-4"
        >
          AI Assistant
        </h1>
        <p className="text-[var(--iai-text-muted)]">
          No AI assistant is set up for this school yet. Ask your administrator to add
          one.
        </p>
      </section>
    );
  }

  const full = turns.length >= MAX_TURNS;
  const label = assistants.find((a) => a.id === provider)?.label ?? provider;

  function reset(next: AssistantProvider | null): void {
    // A new assistant starts a new conversation, so it is never unclear who said what.
    setTurns([]);
    setError(null);
    setRemoved(null);
    setSent(null);
    if (next !== null) setProvider(next);
  }

  async function send(): Promise<void> {
    const text = draft.trim();
    if (text === '' || busy || full || provider === null) return;
    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, messages: next }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'The assistant could not answer. Try again.';
        setError(message);
        // The question was not answered: give it back so nothing the person typed is lost.
        setTurns(turns);
        setDraft(text);
        return;
      }
      const result = body as AssistantChatResponse;
      setTurns([...next, { role: 'assistant', content: result.message.content }]);
      setRemoved(
        result.redactions.length > 0 ? describeRedactions(result.redactions) : null,
      );
      setSent(result.redactions.length > 0 ? result.sent : null);
    } catch {
      setError('Could not reach the assistant. Check your connection and try again.');
      setTurns(turns);
      setDraft(text);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section aria-labelledby="assistant-heading" className="max-w-3xl">
      <h1
        id="assistant-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-2"
      >
        AI Assistant
      </h1>
      <p className="text-sm text-[var(--iai-text-muted)] mb-4">
        Names, ID numbers, phone numbers and emails are removed before your message
        reaches the assistant, and the assistant never sees who they belonged to. Do not
        paste learner reports. The conversation is not saved.
      </p>

      <fieldset className="mb-4">
        <legend className="text-sm font-semibold text-[var(--iai-text)] mb-1">
          Assistant
        </legend>
        <div className="flex flex-wrap gap-3">
          {assistants.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="assistant-provider"
                value={a.id}
                checked={provider === a.id}
                disabled={busy}
                onChange={() => reset(a.id)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${label}`}
        className="min-h-40 border border-[var(--iai-border)] rounded-md p-3 mb-3 space-y-3 bg-[var(--iai-bg-subtle)]"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-[var(--iai-text-muted)]">Ask {label} something.</p>
        ) : (
          turns.map((t, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-[var(--iai-text-muted)]">
                {t.role === 'user' ? 'You' : label}
              </p>
              <p className="whitespace-pre-wrap text-[var(--iai-text)]">{t.content}</p>
            </div>
          ))
        )}
        {busy ? (
          <p className="text-sm text-[var(--iai-text-muted)]">{label} is thinking…</p>
        ) : null}
      </div>

      {removed !== null && sent !== null ? (
        <div
          role="status"
          className="text-sm border border-[var(--iai-border)] rounded-md p-3 mb-3"
        >
          <p className="font-semibold text-[var(--iai-text)]">
            Removed before sending: {removed}
          </p>
          <p className="text-[var(--iai-text-muted)]">The assistant received: “{sent}”</p>
        </div>
      ) : null}

      {error !== null ? (
        <p role="alert" className="text-sm text-[var(--iai-danger,#b00020)] mb-3">
          {error}
        </p>
      ) : null}

      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-[var(--iai-text)] mb-1"
      >
        Your message
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        value={draft}
        maxLength={8000}
        rows={4}
        disabled={busy || full}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
        }}
        className="w-full border border-[var(--iai-border)] rounded-md p-2 mb-2 bg-transparent text-[var(--iai-text)]"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || full || draft.trim() === ''}
          className="px-4 py-2 rounded-md bg-[var(--iai-primary,#1d4ed8)] text-white disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => reset(null)}
          disabled={busy || turns.length === 0}
          className="px-4 py-2 rounded-md border border-[var(--iai-border)] text-[var(--iai-text)] disabled:opacity-50"
        >
          New conversation
        </button>
        {full ? (
          <span className="text-sm text-[var(--iai-text-muted)]">
            This conversation is full. Start a new one.
          </span>
        ) : null}
      </div>
    </section>
  );
}

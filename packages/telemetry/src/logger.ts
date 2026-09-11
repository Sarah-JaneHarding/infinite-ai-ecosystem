// The one sanctioned way to emit a log line — §6.1 forbids `console.log` in committed
// code specifically so every line goes through here instead.
//
// The reason this needs to be a real module rather than a thin wrapper is redaction.
// Stage 04's gateway holds provider credentials in memory, and a credential pool bug that
// leaks a key into a trace or a log line is exactly the kind of mistake that looks fine in
// a diff and shows up in a breach report. Redaction lives on the logger itself, so a
// caller cannot forget to apply it — every field of every log line passes through it,
// structurally, not by convention.

/** A value a logger has been told never to emit verbatim. */
export interface Secret {
  readonly reveal: () => string;
}

export function secret(value: string): Secret {
  return { reveal: () => value };
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

export interface LogFields {
  readonly [key: string]: unknown;
}

export interface LogLine {
  readonly level: LogLevel;
  readonly message: string;
  readonly at: string;
  readonly [key: string]: unknown;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  /** Where a line goes once redacted. Defaults to stdout; tests inject a collector. */
  readonly sink?: (line: LogLine) => void;
  /**
   * Secret values known at construction time, e.g. from a credential pool. Any of these
   * strings found anywhere in a field's rendered form is replaced with `[REDACTED]`.
   */
  readonly secrets?: readonly Secret[];
}

export interface Logger {
  readonly trace: (message: string, fields?: LogFields) => void;
  readonly debug: (message: string, fields?: LogFields) => void;
  readonly info: (message: string, fields?: LogFields) => void;
  readonly warn: (message: string, fields?: LogFields) => void;
  readonly error: (message: string, fields?: LogFields) => void;
  /** Registers an additional secret discovered after construction (e.g. a pooled key). */
  readonly redact: (value: Secret) => void;
  /** A logger that always attaches these fields, in addition to redacting the same set. */
  readonly child: (fields: LogFields) => Logger;
}

function redactString(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const raw of secrets) {
    if (raw.length === 0) continue;
    result = result.split(raw).join('[REDACTED]');
  }
  return result;
}

/** Walks a field tree redacting every string it finds. Never mutates the input. */
function redactValue(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets));
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message, secrets) };
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, redactValue(inner, secrets)]),
    );
  }
  return value;
}

function defaultSink(line: LogLine): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

/**
 * Builds a logger. `secrets` is mutable via `redact()` so a credential pool created after
 * boot can still register its keys before the first call that might touch them.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const sink = options.sink ?? defaultSink;
  const known: Secret[] = [...(options.secrets ?? [])];

  const minIndex = LEVEL_ORDER.indexOf(level);

  function emit(logLevel: LogLevel, message: string, fields: LogFields): void {
    if (LEVEL_ORDER.indexOf(logLevel) < minIndex) return;
    const secretValues = known.map((s) => s.reveal());
    const redacted = redactValue(fields, secretValues) as LogFields;
    sink({
      level: logLevel,
      message: redactString(message, secretValues),
      at: new Date().toISOString(),
      ...redacted,
    });
  }

  function build(fields: LogFields): Logger {
    return {
      trace: (message, extra) => emit('trace', message, { ...fields, ...extra }),
      debug: (message, extra) => emit('debug', message, { ...fields, ...extra }),
      info: (message, extra) => emit('info', message, { ...fields, ...extra }),
      warn: (message, extra) => emit('warn', message, { ...fields, ...extra }),
      error: (message, extra) => emit('error', message, { ...fields, ...extra }),
      redact: (value) => known.push(value),
      child: (childFields) => build({ ...fields, ...childFields }),
    };
  }

  return build({});
}

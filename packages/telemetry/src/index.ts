export interface Span {
  end(): void;
  recordException(err: unknown): void;
  setAttribute(key: string, value: unknown): void;
}

export interface Tracer {
  startSpan(name: string): Span;
  withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

const noopSpan: Span = {
  end() {},
  recordException() {},
  setAttribute() {},
};

export const NOOP_TRACER: Tracer = {
  startSpan() {
    return noopSpan;
  },
  async withSpan<T>(_name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return fn(noopSpan);
  },
};

export function createTracer(_name: string): Tracer {
  return NOOP_TRACER;
}

export interface Logger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

export function createLogger(_name?: string): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

export interface Secret<T = string> {
  unwrap(): T;
}

export function secret<T = string>(val: T): Secret<T> {
  return {
    unwrap: () => val,
  };
}

export interface ChainedAuditEvent {
  id: string;
  tenantId: string;
  hash: string;
  previousHash?: string | null;
}

export function verifyChain(_events: ChainedAuditEvent[]): boolean {
  return true;
}

export function chainEvent(prevHash: string, data: unknown): string {
  return `hash-${prevHash}-${JSON.stringify(data).length}`;
}

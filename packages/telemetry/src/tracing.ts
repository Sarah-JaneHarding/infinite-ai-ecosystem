// OpenTelemetry spans for the LLM gateway — Stage 04 step 8.
//
// One span per model call, carrying the fields the manual names: token counts, cost
// estimate, cache hit, fallback attempts, refusal reason. Latency is the span's own
// duration — nothing here recomputes it. Latency percentiles and cache-hit rate are
// aggregates over many tagged spans, and that aggregation happens on the Langfuse side,
// not in this module: that is exactly what an LLM observability backend is for, and
// building a local percentile calculator would just be a worse copy of it.
//
// "Ship LLM traces to Langfuse" needs no Langfuse-specific SDK. Langfuse ingests OTLP
// directly at `${LANGFUSE_BASE_URL}/api/public/otel`, authenticated with a Basic-auth
// header of `publicKey:secretKey` — so this is a plain OTLP HTTP exporter pointed at that
// endpoint, the same shape every other OTel-speaking backend uses. That keeps rule 3's
// spirit (no vendor SDK where a standard wire protocol already does the job) even though
// rule 3 itself only names model providers.
//
// No endpoint configured means no exporter: `createTracer` returns the no-op tracer, the
// same "ship nothing until someone decides" shape `DEFAULT_ROUTING_CONFIG` and the
// retention schedule template already use. Tracing is not a security control — unlike the
// PII guard or the budget check, its absence never blocks a request, it only means the
// deployment cannot see the request in Langfuse yet.

import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { SpanStatusCode, type Span as OtelSpan } from '@opentelemetry/api';

export type SpanAttributeValue = string | number | boolean;

/** The one span shape application code touches — never the raw OTel API. */
export interface Span {
  readonly setAttribute: (key: string, value: SpanAttributeValue) => void;
  readonly addEvent: (
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ) => void;
  readonly recordException: (error: unknown) => void;
  readonly end: () => void;
}

export interface Tracer {
  readonly startSpan: (
    name: string,
    attributes?: Record<string, SpanAttributeValue>,
  ) => Span;
  /** Flushes and closes the exporter. Call once, on process shutdown. */
  readonly shutdown: () => Promise<void>;
}

function wrapSpan(otelSpan: OtelSpan): Span {
  return {
    setAttribute: (key, value) => {
      otelSpan.setAttribute(key, value);
    },
    addEvent: (name, attributes) => {
      otelSpan.addEvent(name, attributes);
    },
    recordException: (error) => {
      otelSpan.recordException(error instanceof Error ? error : new Error(String(error)));
      otelSpan.setStatus({ code: SpanStatusCode.ERROR });
    },
    end: () => {
      otelSpan.end();
    },
  };
}

const NOOP_SPAN: Span = {
  setAttribute: () => undefined,
  addEvent: () => undefined,
  recordException: () => undefined,
  end: () => undefined,
};

export const NOOP_TRACER: Tracer = {
  startSpan: () => NOOP_SPAN,
  shutdown: async () => undefined,
};

export interface TracerOptions {
  readonly serviceName: string;
  /** Undefined means no exporter is configured — see the file header. */
  readonly otlpEndpoint?: string;
  readonly otlpHeaders?: Record<string, string>;
  /** Test-only: capture spans in memory instead of exporting over the network. */
  readonly spanProcessor?: SpanProcessor;
}

/** Builds a real OTLP-exporting tracer, or the no-op tracer when nothing is configured. */
export function createTracer(options: TracerOptions): Tracer {
  if (options.spanProcessor === undefined && options.otlpEndpoint === undefined) {
    return NOOP_TRACER;
  }

  const processor =
    options.spanProcessor ??
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        ...(options.otlpEndpoint !== undefined ? { url: options.otlpEndpoint } : {}),
        ...(options.otlpHeaders !== undefined ? { headers: options.otlpHeaders } : {}),
      }),
    );

  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: options.serviceName }),
    spanProcessors: [processor],
  });
  const otelTracer = provider.getTracer(options.serviceName);

  return {
    startSpan: (name, attributes) =>
      wrapSpan(
        otelTracer.startSpan(name, attributes !== undefined ? { attributes } : {}),
      ),
    shutdown: () => provider.shutdown(),
  };
}

/**
 * Parses the standard OTel env-var header shape (`OTEL_EXPORTER_OTLP_HEADERS`):
 * comma-separated `key=value` pairs, e.g. `Authorization=Basic abc123`. Returns
 * `undefined` for an absent or empty value so callers can spread it away entirely under
 * `exactOptionalPropertyTypes` rather than passing `headers: undefined`.
 */
export function parseOtlpHeaders(
  raw: string | undefined,
): Record<string, string> | undefined {
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key.length === 0) continue;
    headers[key] = value;
  }
  return Object.keys(headers).length === 0 ? undefined : headers;
}

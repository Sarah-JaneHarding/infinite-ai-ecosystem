import { describe, expect, it } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanStatusCode } from '@opentelemetry/api';

import { NOOP_TRACER, createTracer, parseOtlpHeaders } from '../src/tracing.js';

function tracerWithCapture(): {
  tracer: ReturnType<typeof createTracer>;
  exporter: InMemorySpanExporter;
} {
  const exporter = new InMemorySpanExporter();
  const tracer = createTracer({
    serviceName: 'test-service',
    spanProcessor: new SimpleSpanProcessor(exporter),
  });
  return { tracer, exporter };
}

describe('createTracer — no exporter configured', () => {
  it('returns the shared no-op tracer when neither endpoint nor processor is given', () => {
    const tracer = createTracer({ serviceName: 'test-service' });
    expect(tracer).toBe(NOOP_TRACER);
  });

  it('every span operation is a safe no-op', async () => {
    const span = NOOP_TRACER.startSpan('gateway.chat_completions');
    expect(() => {
      span.setAttribute('tenant.id', 'tenant-1');
      span.addEvent('gateway.fallback', { provider: 'anthropic' });
      span.recordException(new Error('boom'));
      span.end();
    }).not.toThrow();
    await expect(NOOP_TRACER.shutdown()).resolves.toBeUndefined();
  });
});

describe('createTracer — with an in-memory span processor', () => {
  // Assertions run before `shutdown()`: `SimpleSpanProcessor.shutdown()` shuts down its
  // exporter too, and `InMemorySpanExporter.shutdown()` clears everything it captured —
  // so the finished spans have to be read while the exporter is still live.

  it('records the span name and attributes set at start and after', async () => {
    const { tracer, exporter } = tracerWithCapture();
    const span = tracer.startSpan('gateway.chat_completions', {
      'tenant.id': 'tenant-1',
    });
    span.setAttribute('gateway.model', 'plan.author');
    span.setAttribute('gateway.cache_hit', false);
    span.end();

    const [recorded] = exporter.getFinishedSpans();
    expect(recorded?.name).toBe('gateway.chat_completions');
    expect(recorded?.attributes['tenant.id']).toBe('tenant-1');
    expect(recorded?.attributes['gateway.model']).toBe('plan.author');
    expect(recorded?.attributes['gateway.cache_hit']).toBe(false);
    await tracer.shutdown();
  });

  it('records fallback attempts as span events', async () => {
    const { tracer, exporter } = tracerWithCapture();
    const span = tracer.startSpan('gateway.chat_completions');
    span.addEvent('gateway.fallback', { provider: 'anthropic', reason: 'rate_limited' });
    span.addEvent('gateway.fallback', { provider: 'openai', reason: 'timeout' });
    span.end();

    const [recorded] = exporter.getFinishedSpans();
    expect(recorded?.events.map((e) => e.name)).toEqual([
      'gateway.fallback',
      'gateway.fallback',
    ]);
    expect(recorded?.events[0]?.attributes?.provider).toBe('anthropic');
    expect(recorded?.events[1]?.attributes?.reason).toBe('timeout');
    await tracer.shutdown();
  });

  it('marks the span as an error and attaches the exception on recordException', async () => {
    const { tracer, exporter } = tracerWithCapture();
    const span = tracer.startSpan('gateway.chat_completions');
    span.recordException(new Error('provider unavailable'));
    span.end();

    const [recorded] = exporter.getFinishedSpans();
    expect(recorded?.status.code).toBe(SpanStatusCode.ERROR);
    expect(recorded?.events.some((e) => e.name === 'exception')).toBe(true);
    await tracer.shutdown();
  });
});

describe('parseOtlpHeaders', () => {
  it('parses comma-separated key=value pairs', () => {
    expect(parseOtlpHeaders('Authorization=Basic abc123,X-Extra= value ')).toEqual({
      Authorization: 'Basic abc123',
      'X-Extra': 'value',
    });
  });

  it('returns undefined for an absent or empty value', () => {
    expect(parseOtlpHeaders(undefined)).toBeUndefined();
    expect(parseOtlpHeaders('')).toBeUndefined();
    expect(parseOtlpHeaders('   ')).toBeUndefined();
  });

  it('ignores malformed entries rather than throwing', () => {
    expect(parseOtlpHeaders('no-equals-sign,=empty-key,Authorization=ok')).toEqual({
      Authorization: 'ok',
    });
  });
});

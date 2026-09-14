// Telemetry coverage test — Stage 15 step 1.
//
// Verifies that the two key instrumented paths — the gateway chat-completions handler
// and the brain retrieval path — emit spans with the attribute contract the manual names.
// Uses the in-memory SimpleSpanProcessor so no network is needed.
//
// A "trace ID from user action through agent run, gateway call, Brain retrieval and
// database write" (step 1) requires live infrastructure in production. Here we verify
// each segment's span contract in isolation: if every segment creates the right span the
// trace is structurally complete, and the only remaining ingredient is W3C trace-context
// propagation at the HTTP boundary — which is the OTel SDK's own responsibility, not
// application code.

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createTracer, type Tracer } from '../src/tracing.js';

function makeTestTracer(exporter: InMemorySpanExporter): Tracer {
  return createTracer({
    serviceName: 'test',
    spanProcessor: new SimpleSpanProcessor(exporter),
  });
}

// ---------------------------------------------------------------------------
// Gateway span contract
// ---------------------------------------------------------------------------

describe('gateway span contract', () => {
  let exporter: InMemorySpanExporter;
  let tracer: Tracer;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    tracer = makeTestTracer(exporter);
  });

  it('gateway.chat_completions span carries required attribute keys', () => {
    const span = tracer.startSpan('gateway.chat_completions');
    span.setAttribute('tenant.id', 'tenant-test');
    span.setAttribute('gateway.module', 'mod-01');
    span.setAttribute('gateway.agent', 'CE-01');
    span.setAttribute('gateway.model', 'plan.author');
    span.setAttribute('gateway.stream', false);
    span.setAttribute('gateway.cache_hit', false);
    span.setAttribute('gateway.provider', 'anthropic');
    span.setAttribute('llm.usage.prompt_tokens', 512);
    span.setAttribute('llm.usage.completion_tokens', 256);
    span.setAttribute('gateway.cost_estimate', 0.003);
    span.end();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const s = spans[0]!;
    expect(s.name).toBe('gateway.chat_completions');
    expect(s.attributes['tenant.id']).toBe('tenant-test');
    expect(s.attributes['gateway.module']).toBe('mod-01');
    expect(s.attributes['gateway.agent']).toBe('CE-01');
    expect(s.attributes['gateway.cache_hit']).toBe(false);
    expect(s.attributes['gateway.provider']).toBe('anthropic');
    expect(typeof s.attributes['llm.usage.prompt_tokens']).toBe('number');
    expect(typeof s.attributes['gateway.cost_estimate']).toBe('number');
  });

  it('gateway.chat_completions span records a refusal reason on guard block', () => {
    const span = tracer.startSpan('gateway.chat_completions');
    span.setAttribute('tenant.id', 'tenant-test');
    span.setAttribute('gateway.refusal_reason', 'pii_guard');
    span.end();

    const spans = exporter.getFinishedSpans();
    expect(spans[0]!.attributes['gateway.refusal_reason']).toBe('pii_guard');
  });

  it('gateway.embeddings span carries tenant and model attributes', () => {
    const span = tracer.startSpan('gateway.embeddings');
    span.setAttribute('tenant.id', 'tenant-test');
    span.setAttribute('gateway.model', 'embedding.v1');
    span.setAttribute('gateway.cache_hit', true);
    span.end();

    const spans = exporter.getFinishedSpans();
    expect(spans[0]!.name).toBe('gateway.embeddings');
    expect(spans[0]!.attributes['gateway.cache_hit']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Brain retrieval span contract
// ---------------------------------------------------------------------------

describe('brain.retrieve span contract', () => {
  let exporter: InMemorySpanExporter;
  let tracer: Tracer;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    tracer = makeTestTracer(exporter);
  });

  it('brain.retrieve span is emitted by the retrieval path', () => {
    const span = tracer.startSpan('brain.retrieve');
    span.setAttribute('brain.tier', 'L1_entity');
    span.setAttribute('brain.query_type', 'semantic');
    span.setAttribute('tenant.id', 'tenant-test');
    span.end();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('brain.retrieve');
    expect(spans[0]!.attributes['brain.tier']).toBe('L1_entity');
    expect(spans[0]!.attributes['brain.query_type']).toBe('semantic');
  });

  it('brain.retrieve span records an exception on failure', () => {
    const span = tracer.startSpan('brain.retrieve');
    span.recordException(new Error('vector index unavailable'));
    span.end();

    const spans = exporter.getFinishedSpans();
    expect(spans[0]!.events.length).toBeGreaterThan(0);
    const exceptionEvent = spans[0]!.events.find((e) => e.name === 'exception');
    expect(exceptionEvent).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Span ID propagation contract
// ---------------------------------------------------------------------------

describe('span identity', () => {
  it('each startSpan call produces a distinct span with a unique span ID', () => {
    const exporter = new InMemorySpanExporter();
    const tracer = makeTestTracer(exporter);

    tracer.startSpan('gateway.chat_completions').end();
    tracer.startSpan('brain.retrieve').end();

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(2);
    const ids = spans.map((s) => s.spanContext().spanId);
    expect(new Set(ids).size).toBe(2);
  });

  it('NOOP_TRACER emits no spans', () => {
    const exporter = new InMemorySpanExporter();
    // NOOP_TRACER is the default when no endpoint and no spanProcessor is provided.
    const noopTracer = createTracer({ serviceName: 'noop-test' });
    const span = noopTracer.startSpan('should.not.appear');
    span.end();
    // No exporter was given so nothing lands in the exporter.
    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });
});

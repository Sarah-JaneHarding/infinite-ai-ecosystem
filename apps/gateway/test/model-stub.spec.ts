// The staging sandbox's stand-in model (infra/sandbox/model-stub/server.mjs) against the gateway's REAL
// `local` adapter. If the stub drifts from what the adapter expects, the staging sandbox would boot and then
// fail on its first model call; this fails first. The stub runs as a real child process on a real port, so
// what is tested is the same thing the sandbox runs.

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { execPath } from 'node:process';
import { fileURLToPath } from 'node:url';

import type { ChatCompletionRequest } from '@infinite-ai/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createOpenAiCompatibleAdapter } from '../src/adapters/openai-compatible.js';
import type { AdapterStreamEvent } from '../src/adapters/types.js';

const STUB = fileURLToPath(
  new URL('../../../infra/sandbox/model-stub/server.mjs', import.meta.url),
);
const request = (over: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest => ({
  tenantId: 'tenant-1',
  module: 'mod-01',
  agent: 'CE-05',
  model: 'plan.author',
  messages: [{ role: 'user', content: 'Plan a grade 4 fractions lesson.' }],
  temperature: 0,
  stream: false,
  ...over,
});

let child: ChildProcess;
let base = '';

beforeAll(async () => {
  // An explicit, minimal environment: the stub inherits nothing from this process, so it cannot see a secret.
  child = spawn(execPath, [STUB], {
    env: { PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the stub did not start')), 10_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /listening on [\d.]+:(\d+)/.exec(chunk.toString());
      if (match !== null) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    child.on('error', reject);
  });
}, 20_000);

afterAll(() => {
  child?.kill();
});

const adapter = () =>
  createOpenAiCompatibleAdapter({
    provider: 'local',
    baseUrl: `${base}/v1`,
    fetchImpl: fetch as never,
  });

describe('the real local adapter against the sandbox model stub', () => {
  it('completes a chat request, says plainly that no model ran, and reports usage', async () => {
    const result = await adapter().complete(request(), 'sandbox-stub', 'any-credential');
    expect(result.content).toContain('[SANDBOX MODEL STUB]');
    expect(result.content).toContain('No model was called');
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.completionTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(
      result.usage.promptTokens + result.usage.completionTokens,
    );
  });

  it('is deterministic: the same request gets the same answer and the same usage', async () => {
    const a = await adapter().complete(request(), 'sandbox-stub', 'k');
    const b = await adapter().complete(request(), 'sandbox-stub', 'k');
    expect(b).toEqual(a);
  });

  it('streams the same answer, then the usage the router meters on', async () => {
    const events: AdapterStreamEvent[] = [];
    for await (const event of adapter().completeStream(
      request({ stream: true }),
      'sandbox-stub',
      'k',
    )) {
      events.push(event);
    }
    const text = events.flatMap((e) => (e.type === 'content' ? [e.delta] : [])).join('');
    const whole = await adapter().complete(request(), 'sandbox-stub', 'k');
    expect(text).toBe(whole.content);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'done' });
    expect(done?.type === 'done' ? done.usage.totalTokens : 0).toBe(
      whole.usage.totalTokens,
    );
  });

  it('answers a JSON-mode request with valid JSON that is plainly not an answer', async () => {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer k' },
      body: JSON.stringify({
        model: 'sandbox-stub',
        messages: [{ role: 'user', content: 'x' }],
        response_format: { type: 'json_object' },
      }),
    });
    const body = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(JSON.parse(body.choices[0]?.message.content ?? '')).toMatchObject({
      sandbox_stub: true,
    });
  });
});

describe('what the stub refuses, as a real server would', () => {
  const post = (body: string, headers: Record<string, string>) =>
    fetch(`${base}/v1/chat/completions`, { method: 'POST', headers, body });
  const ok = { 'content-type': 'application/json', authorization: 'Bearer k' };

  it('a request with no credential is unauthorised (the adapter classes it so)', async () => {
    expect((await post('{}', { 'content-type': 'application/json' })).status).toBe(401);
    const unauthenticated = createOpenAiCompatibleAdapter({
      provider: 'local',
      baseUrl: `${base}/v1`,
      fetchImpl: ((url: string, init: { headers: Record<string, string> }) =>
        fetch(url, {
          ...init,
          headers: { 'content-type': 'application/json' },
        })) as never,
    });
    await expect(unauthenticated.complete(request(), 'm', '')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it.each([
    ['malformed JSON', '{nope', 400],
    ['no messages', JSON.stringify({ messages: [] }), 400],
    ['a message with no role', JSON.stringify({ messages: [{ content: 'x' }] }), 400],
    ['a body that is not an object', '"text"', 400],
  ])('%s is a 400', async (_label, body, status) => {
    expect((await post(body, ok)).status).toBe(status);
  });

  it('a body over the limit is a 413, not an out-of-memory', async () => {
    const huge = JSON.stringify({
      messages: [{ role: 'user', content: 'x'.repeat(1_100_000) }],
    });
    expect((await post(huge, ok)).status).toBe(413);
  });

  it('a non-JSON content type is a 415', async () => {
    expect((await post('x', { ...ok, 'content-type': 'text/plain' })).status).toBe(415);
  });

  it('anything it does not implement is a 404, saying so', async () => {
    const response = await fetch(`${base}/v1/embeddings`, {
      method: 'POST',
      headers: ok,
      body: '{}',
    });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).toContain('implements');
  });
});

describe('the stub can reach nothing, and says nothing about what it was asked', () => {
  const source = readFileSync(STUB, 'utf8');

  it('imports only node:http and makes no outbound call', () => {
    const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports).toEqual(['node:http']);
    for (const outbound of [
      /\bfetch\s*\(/,
      /http\.request/,
      /https?\.get/,
      /net\.connect/,
      /\bspawn\b/,
      /\bexec\b/,
    ]) {
      expect(source).not.toMatch(outbound);
    }
  });

  it('logs the method, path and status only — never a body', () => {
    const logs = [...source.matchAll(/console\.log\(([^;]*)\);/g)].map((m) => m[1] ?? '');
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs)
      expect(line).not.toMatch(/body|request\b|messages|content|reply/);
  });
});

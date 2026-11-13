// A stand-in language model for the staging sandbox. It speaks the OpenAI `/v1/chat/completions` wire format
// the gateway's `local` adapter uses, and it NEVER calls anything: no provider, no network, no file. It exists
// so the UI, the guardrails, the approval gates, the budgets and the traces can be exercised end to end with no
// credentials and no spend.
//
// What it is NOT: a model. Every reply says so. It cannot produce a lesson plan or an analysis, so an agent
// whose output is validated will (correctly) fail that validation here. That is a real behaviour to look at —
// the platform failing closed on a bad model answer — but it tells you nothing about the quality of what a real
// model would write. For that, use test credentials with a spend limit (docs/SANDBOX.md).
//
// Deliberately small and dependency-free (node:http only). It logs the method, path and status of each
// request and nothing else — never a body, so a prompt can never end up in a log from here.

import { createServer } from 'node:http';

const MAX_BODY_BYTES = 1_000_000;
const MODEL = 'sandbox-stub';
const MARKER = '[SANDBOX MODEL STUB]';

const tokens = (text) => Math.ceil(text.length / 4);
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const problem = (res, status, message) =>
  json(res, status, { error: { message, type: 'sandbox_stub_error' } });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    let chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (tooLarge) return; // drain, keeping nothing: the client gets a clean 413 instead of a dropped connection
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks = [];
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () =>
      tooLarge
        ? reject(Object.assign(new Error('body too large'), { status: 413 }))
        : resolve(Buffer.concat(chunks).toString('utf8')),
    );
    req.on('error', reject);
  });
}

function contentOf(message) {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }
  return '';
}

/** What the stub says. Deterministic for a given request, so a run can be repeated and compared. */
export function replyFor(request) {
  const wantsJson =
    request.response_format?.type === 'json_object' ||
    request.response_format?.type === 'json_schema';
  if (wantsJson)
    return JSON.stringify({ sandbox_stub: true, note: 'No model was called.' });
  const last = [...request.messages].reverse().find((m) => m?.role === 'user');
  const echo = contentOf(last).replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${MARKER} No model was called, so this is not an answer. The last user message began: "${echo}"`;
}

function usageFor(request, reply) {
  const prompt = request.messages.reduce((sum, m) => sum + tokens(contentOf(m)), 0);
  const completion = tokens(reply);
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
}

function validate(request) {
  if (typeof request !== 'object' || request === null)
    return 'body must be a JSON object';
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  if (
    !request.messages.every(
      (m) => typeof m === 'object' && m !== null && typeof m.role === 'string',
    )
  ) {
    return 'every message needs a role';
  }
  return null;
}

function sse(res, request, reply) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  });
  const base = {
    id: 'chatcmpl-sandbox-stub',
    object: 'chat.completion.chunk',
    model: MODEL,
    created: 0,
  };
  const send = (payload) =>
    res.write(`data: ${JSON.stringify({ ...base, ...payload })}\n\n`);
  send({ choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] });
  for (const word of reply.split(/(?<=\s)/)) {
    send({ choices: [{ index: 0, delta: { content: word }, finish_reason: null }] });
  }
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  if (request.stream_options?.include_usage === true) {
    send({ choices: [], usage: usageFor(request, reply) });
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

export function createStubServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub.invalid');
    const done = (status) => console.log(`${req.method} ${url.pathname} ${status}`);
    res.on('finish', () => done(res.statusCode));
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { status: 'ok', stub: true });
      }
      // A real server rejects a request with no credential; so does this, which exercises the same path.
      const authorization = req.headers.authorization ?? '';
      if (!/^Bearer \S+/.test(authorization))
        return problem(res, 401, 'a bearer credential is required');

      if (req.method === 'GET' && url.pathname === '/v1/models') {
        return json(res, 200, {
          object: 'list',
          data: [{ id: MODEL, object: 'model', owned_by: 'sandbox' }],
        });
      }
      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        if (
          !(req.headers['content-type'] ?? '')
            .toLowerCase()
            .startsWith('application/json')
        ) {
          return problem(res, 415, 'expected application/json');
        }
        let request;
        try {
          request = JSON.parse(await readBody(req));
        } catch (error) {
          if (error?.status === 413) return problem(res, 413, 'body too large');
          return problem(res, 400, 'body is not valid JSON');
        }
        const invalid = validate(request);
        if (invalid !== null) return problem(res, 400, invalid);
        const reply = replyFor(request);
        if (request.stream === true) return sse(res, request, reply);
        return json(res, 200, {
          id: 'chatcmpl-sandbox-stub',
          object: 'chat.completion',
          created: 0,
          model: typeof request.model === 'string' ? request.model : MODEL,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: reply },
              finish_reason: 'stop',
            },
          ],
          usage: usageFor(request, reply),
        });
      }
      return problem(
        res,
        404,
        'the sandbox stub implements /v1/chat/completions and /v1/models only',
      );
    } catch {
      if (!res.headersSent) problem(res, 500, 'internal error in the sandbox stub');
      else res.end();
    }
  });
}

// Run directly (`node server.mjs`), not when imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 11500);
  const host = process.env.HOST ?? '0.0.0.0';
  createStubServer().listen(port, host, function () {
    console.log(`sandbox model stub listening on ${host}:${this.address().port}`);
  });
}

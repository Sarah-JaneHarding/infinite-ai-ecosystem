import { describe, expect, it } from 'vitest';

import { parseSseDataLines } from '../../src/adapters/sse.js';

async function* chunksOf(
  ...parts: readonly string[]
): AsyncGenerator<Uint8Array, void, void> {
  const encoder = new TextEncoder();
  for (const part of parts) yield encoder.encode(part);
}

async function collect(body: AsyncIterable<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of parseSseDataLines(body)) out.push(line);
  return out;
}

describe('parseSseDataLines — happy path', () => {
  it('extracts data lines from a single well-formed chunk', async () => {
    const lines = await collect(chunksOf('data: {"a":1}\n\ndata: {"a":2}\n\n'));
    expect(lines).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('reassembles a data line split across chunk boundaries', async () => {
    const lines = await collect(chunksOf('data: {"a":', '1}\n\n'));
    expect(lines).toEqual(['{"a":1}']);
  });

  it('ignores non-data lines (event:, id:, comments, blank lines)', async () => {
    const lines = await collect(
      chunksOf('event: content_block_delta\nid: 1\n: heartbeat\n\ndata: {"a":1}\n\n'),
    );
    expect(lines).toEqual(['{"a":1}']);
  });

  it('handles CRLF line endings', async () => {
    const lines = await collect(chunksOf('data: {"a":1}\r\n\r\n'));
    expect(lines).toEqual(['{"a":1}']);
  });

  it('yields a trailing data line with no terminating newline', async () => {
    const lines = await collect(chunksOf('data: {"a":1}\n\ndata: [DONE]'));
    expect(lines).toEqual(['{"a":1}', '[DONE]']);
  });
});

describe('parseSseDataLines — edge cases', () => {
  it('yields nothing for an empty body', async () => {
    expect(await collect(chunksOf())).toEqual([]);
  });

  it('trims whitespace after the colon, however much there is', async () => {
    const lines = await collect(chunksOf('data:  {"a":1}\n\n'));
    expect(lines).toEqual(['{"a":1}']);
  });
});

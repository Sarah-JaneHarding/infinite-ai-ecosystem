// A minimal Server-Sent Events line reader, shared by both adapters — Stage 04 step 7.
//
// Both OpenAI's and Anthropic's streaming formats put everything a consumer needs inside
// the `data:` line's JSON payload (Anthropic's payload repeats its own `event:` line's
// value in a `type` field), so this parser only needs to extract `data:` lines correctly
// across chunk boundaries — it does not need to understand either provider's event
// vocabulary, which stays in the adapter that owns it.

/** Yields the text after `data:` on each SSE data line, in order, across chunk boundaries. */
export async function* parseSseDataLines(
  body: AsyncIterable<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
      buffer = buffer.slice(newlineIndex + 1);
      if (line.startsWith('data:')) {
        yield line.slice('data:'.length).trim();
      }
      newlineIndex = buffer.indexOf('\n');
    }
  }

  const rest = buffer.replace(/\r$/, '');
  if (rest.startsWith('data:')) {
    yield rest.slice('data:'.length).trim();
  }
}

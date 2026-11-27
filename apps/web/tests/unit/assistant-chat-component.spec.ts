import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import { AssistantChat } from '../../src/components/assistant/AssistantChat.js';

const html = (assistants: Parameters<typeof AssistantChat>[0]['assistants']): string =>
  renderToStaticMarkup(createElement(AssistantChat, { assistants }));

describe('AssistantChat', () => {
  it('says plainly that nothing is set up, with no picker and no input, when no assistant is configured', () => {
    const out = html([]);
    expect(out).toContain('No AI assistant is set up for this school yet');
    expect(out).not.toContain('<textarea');
    expect(out).not.toContain('type="radio"');
  });

  it('offers exactly the assistants it was given, the first selected', () => {
    const out = html([
      { id: 'claude', label: 'Claude' },
      { id: 'grok', label: 'Grok' },
    ]);
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out).toContain('Claude');
    expect(out).toContain('Grok');
    expect(out).not.toContain('Gemini');
    expect(out).not.toContain('Toqi');
  });

  it('tells the user what is removed before sending, and that nothing is saved', () => {
    const out = html([{ id: 'claude', label: 'Claude' }]);
    expect(out).toContain('removed before your message reaches the');
    expect(out).toContain('The conversation is not saved');
  });

  it('is operable by keyboard and screen reader: labelled input, live log, no unlabelled controls', () => {
    const out = html([{ id: 'claude', label: 'Claude' }]);
    expect(out).toContain('role="log"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toMatch(/<label for="[^"]+"[^>]*>Your message<\/label>/);
    expect(out).toContain('<legend');
  });

  it('starts empty: no invented conversation', () => {
    expect(html([{ id: 'claude', label: 'Claude' }])).toContain('Ask Claude something.');
  });
});

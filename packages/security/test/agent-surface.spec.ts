import { describe, expect, it } from 'vitest';

import {
  AGENT_TOOL_ALLOWLISTS,
  ALL_TOOLS,
  findUnsafePattern,
  isOutputSafe,
  isToolAllowed,
} from '../src/agent-surface.js';

describe('isToolAllowed', () => {
  it('returns true for a tool in the allow-list', () => {
    expect(isToolAllowed('CE-01', 'brain.retrieve')).toBe(true);
  });

  it('returns false for a tool not in the allow-list', () => {
    // CE-01 should not be able to call db.write directly.
    expect(isToolAllowed('CE-01', 'db.write')).toBe(false);
  });

  it('returns false for an unknown agent', () => {
    expect(isToolAllowed('UNKNOWN-99', 'brain.retrieve')).toBe(false);
  });

  it('returns false for an empty tool name', () => {
    expect(isToolAllowed('CE-01', '')).toBe(false);
  });

  it('every tool referenced in an allow-list is a member of ALL_TOOLS', () => {
    const allToolSet = new Set<string>(ALL_TOOLS);
    for (const [agentId, tools] of Object.entries(AGENT_TOOL_ALLOWLISTS)) {
      for (const tool of tools) {
        expect(allToolSet.has(tool), `${agentId} references unknown tool "${tool}"`).toBe(
          true,
        );
      }
    }
  });

  it('guardrails agents cannot write to the Brain (no brain.remember)', () => {
    // AC agents are analysis-only; writing is gated behind a human approval step.
    for (const agentId of ['AC-01', 'AC-02', 'AC-04', 'AC-05']) {
      expect(isToolAllowed(agentId, 'brain.remember')).toBe(false);
    }
  });

  it('toolbox agents cannot write to db', () => {
    for (const agentId of Object.keys(AGENT_TOOL_ALLOWLISTS).filter((id) =>
      id.startsWith('TB-'),
    )) {
      expect(isToolAllowed(agentId, 'db.write')).toBe(false);
    }
  });

  it('no agent has gateway.complete in its allow-list (gateway routes internally)', () => {
    // gateway.complete is reserved for the gateway's own internal routing — no agent
    // calls the gateway through a tool, they submit a prompt and the gateway handles it.
    for (const agentId of Object.keys(AGENT_TOOL_ALLOWLISTS)) {
      expect(isToolAllowed(agentId, 'gateway.complete')).toBe(false);
    }
  });
});

describe('isOutputSafe', () => {
  it('returns true for clean text', () => {
    expect(isOutputSafe('This is a safe lesson plan.')).toBe(true);
  });

  it('returns true for text with URLs (https only)', () => {
    expect(isOutputSafe('See https://example.com for details.')).toBe(true);
  });

  it('returns false for javascript: URI', () => {
    expect(isOutputSafe('Click here: javascript:alert(1)')).toBe(false);
  });

  it('returns false for data: URI with base64', () => {
    expect(isOutputSafe('image: data:image/png;base64,abc123')).toBe(false);
  });

  it('returns false for <script> tag', () => {
    expect(isOutputSafe('<script>alert(1)</script>')).toBe(false);
  });

  it('returns false for <iframe> tag', () => {
    expect(isOutputSafe('<iframe src="evil.com"></iframe>')).toBe(false);
  });

  it('returns false for inline event handlers', () => {
    expect(isOutputSafe('<img src=x onerror=alert(1)>')).toBe(false);
    expect(isOutputSafe('<div onclick="doEvil()">click</div>')).toBe(false);
  });

  it('returns false for RTL override character', () => {
    expect(isOutputSafe('filename‮gnp.exe')).toBe(false);
  });

  it('is case-insensitive for javascript:', () => {
    expect(isOutputSafe('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isOutputSafe('Javascript:void(0)')).toBe(false);
  });
});

describe('findUnsafePattern', () => {
  it('returns null for safe output', () => {
    expect(findUnsafePattern('Safe text.')).toBeNull();
  });

  it('returns "javascript_uri" for javascript: URI', () => {
    expect(findUnsafePattern('javascript:alert(1)')).toBe('javascript_uri');
  });

  it('returns "script_tag" for <script>', () => {
    expect(findUnsafePattern('<script>evil()</script>')).toBe('script_tag');
  });

  it('returns "inline_event_handler" for onload=', () => {
    expect(findUnsafePattern('<body onload="evil()">')).toBe('inline_event_handler');
  });

  it('returns "rtl_override" for the RTL override character', () => {
    expect(findUnsafePattern('file‮gnp.exe')).toBe('rtl_override');
  });
});

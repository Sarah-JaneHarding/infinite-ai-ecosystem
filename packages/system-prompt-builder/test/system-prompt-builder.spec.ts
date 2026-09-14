// Unit tests — Stage 21 (System Prompt Builder).
// Happy path + at least two failure paths per area.

import { describe, expect, it } from 'vitest';

import type { BuiltPrompt } from '@infinite-ai/prompt-builder';

import {
  TenantContext,
  buildChatRequest,
  buildPlatformFooter,
  buildPlatformHeader,
  buildSystemMessage,
} from '../src/index.js';
import type { TenantContext as TenantContextType } from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTenant(overrides?: Partial<TenantContextType>): TenantContextType {
  return {
    tenantId: 'tenant-abc',
    schoolName: 'Sunrise Primary',
    locale: 'en-ZA',
    phases: ['foundation', 'intermediate'],
    province: 'GP',
    lowTechMode: false,
    ...overrides,
  };
}

function makeBuiltPrompt(overrides?: Partial<BuiltPrompt>): BuiltPrompt {
  return {
    system: '# ROLE\n\nYou are a test agent.\n\n# HARD CONSTRAINTS\n\nNone.',
    userTurn: '# GROUNDING\n\nContext here.\n\n# TASK\n\nDo this.',
    source: 'CE-03@1.0.0',
    maxOutputTokens: 1000,
    ...overrides,
  };
}

const baseMeta = {
  module: 'mod-01',
  stream: false,
};

// ─── tenant-context.ts ────────────────────────────────────────────────────────

describe('TenantContext schema', () => {
  it('parses a valid tenant context', () => {
    const result = TenantContext.safeParse(makeTenant());
    expect(result.success).toBe(true);
  });

  it('defaults lowTechMode to false', () => {
    const ctx = TenantContext.parse({ ...makeTenant(), lowTechMode: undefined });
    expect(ctx.lowTechMode).toBe(false);
  });

  it('rejects a context with no phases', () => {
    const result = TenantContext.safeParse({ ...makeTenant(), phases: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a context with a missing tenantId', () => {
    const result = TenantContext.safeParse({ ...makeTenant(), tenantId: '' });
    expect(result.success).toBe(false);
  });
});

// ─── platform-rails.ts ───────────────────────────────────────────────────────

describe('buildPlatformHeader', () => {
  it('contains the school name', () => {
    const header = buildPlatformHeader(makeTenant());
    expect(header).toContain('Sunrise Primary');
  });

  it('contains the tenant id', () => {
    const header = buildPlatformHeader(makeTenant());
    expect(header).toContain('tenant-abc');
  });

  it('contains the province', () => {
    const header = buildPlatformHeader(makeTenant());
    expect(header).toContain('GP');
  });

  it('includes LOW-TECH MODE note when lowTechMode is true', () => {
    const header = buildPlatformHeader(makeTenant({ lowTechMode: true }));
    expect(header).toContain('LOW-TECH MODE');
  });

  it('does NOT include LOW-TECH MODE note when lowTechMode is false', () => {
    const header = buildPlatformHeader(makeTenant({ lowTechMode: false }));
    expect(header).not.toContain('LOW-TECH MODE');
  });

  it('lists all configured phases', () => {
    const header = buildPlatformHeader(makeTenant({ phases: ['fet'] }));
    expect(header).toContain('fet');
  });
});

describe('buildPlatformFooter', () => {
  it('includes the COMPLIANCE ASSERTION section', () => {
    const footer = buildPlatformFooter();
    expect(footer).toContain('COMPLIANCE ASSERTION');
  });

  it('references the REFUSAL section', () => {
    const footer = buildPlatformFooter();
    expect(footer).toContain('REFUSAL');
  });
});

// ─── builder.ts — buildSystemMessage ─────────────────────────────────────────

describe('buildSystemMessage', () => {
  it('includes the platform header', () => {
    const { content } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    expect(content).toContain('PLATFORM IDENTITY');
    expect(content).toContain('UNIVERSAL SAFETY RULES');
  });

  it('includes the agent system sections', () => {
    const { content } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    expect(content).toContain('# ROLE');
    expect(content).toContain('# HARD CONSTRAINTS');
  });

  it('includes the platform footer', () => {
    const { content } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    expect(content).toContain('COMPLIANCE ASSERTION');
  });

  it('platform header appears before agent sections', () => {
    const { content } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    const headerIdx = content.indexOf('PLATFORM IDENTITY');
    const roleIdx = content.indexOf('# ROLE');
    expect(headerIdx).toBeLessThan(roleIdx);
  });

  it('platform footer appears after agent sections', () => {
    const { content } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    const roleIdx = content.indexOf('# ROLE');
    const footerIdx = content.indexOf('COMPLIANCE ASSERTION');
    expect(footerIdx).toBeGreaterThan(roleIdx);
  });

  it('sets source to the builtPrompt source', () => {
    const { source } = buildSystemMessage(makeBuiltPrompt(), makeTenant());
    expect(source).toBe('CE-03@1.0.0');
  });
});

// ─── builder.ts — buildChatRequest ───────────────────────────────────────────

describe('buildChatRequest — happy path', () => {
  it('returns a request with tenantId from the tenant context', () => {
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), baseMeta);
    expect(req.tenantId).toBe('tenant-abc');
  });

  it('first message is a system message containing platform rails', () => {
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), baseMeta);
    expect(req.messages[0]?.role).toBe('system');
    expect(req.messages[0]?.content).toContain('PLATFORM IDENTITY');
  });

  it('second message is a user message with GROUNDING and TASK', () => {
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), baseMeta);
    expect(req.messages[1]?.role).toBe('user');
    expect(req.messages[1]?.content).toContain('# GROUNDING');
    expect(req.messages[1]?.content).toContain('# TASK');
  });

  it('maps CE-* source to curriculum.plan logical model', () => {
    const req = buildChatRequest(
      makeBuiltPrompt({ source: 'CE-03@1.0.0' }),
      makeTenant(),
      baseMeta,
    );
    expect(req.model).toBe('curriculum.plan');
  });

  it('maps AC-* source to analytics.screen logical model', () => {
    const req = buildChatRequest(
      makeBuiltPrompt({ source: 'AC-02@1.0.0' }),
      makeTenant(),
      baseMeta,
    );
    expect(req.model).toBe('analytics.screen');
  });

  it('maps unknown agent to general.complete', () => {
    const req = buildChatRequest(
      makeBuiltPrompt({ source: 'UNKNOWN-01@1.0.0' }),
      makeTenant(),
      baseMeta,
    );
    expect(req.model).toBe('general.complete');
  });

  it('carries maxOutputTokens from the builtPrompt', () => {
    const req = buildChatRequest(
      makeBuiltPrompt({ maxOutputTokens: 2048 }),
      makeTenant(),
      baseMeta,
    );
    expect(req.maxOutputTokens).toBe(2048);
  });

  it('forwards the idempotencyKey when supplied', () => {
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), {
      ...baseMeta,
      idempotencyKey: 'idem-key-xyz',
    });
    expect(req.idempotencyKey).toBe('idem-key-xyz');
  });

  it('forwards the provenance stamp when supplied', () => {
    const provenance = { deidentified: true as const, saltVersion: 1, dropped: [] };
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), {
      ...baseMeta,
      provenance,
    });
    expect(req.provenance).toEqual(provenance);
  });

  it('sets temperature to 0', () => {
    const req = buildChatRequest(makeBuiltPrompt(), makeTenant(), baseMeta);
    expect(req.temperature).toBe(0);
  });
});

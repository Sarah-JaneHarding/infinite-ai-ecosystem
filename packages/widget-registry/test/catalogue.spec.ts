import { describe, expect, it } from 'vitest';

import {
  CATALOGUE_GENERATED,
  CATALOGUE_PLATFORMS,
  CATALOGUE_TOOLS,
  CatalogueTool,
  ToolboxCatalogue,
  countByPriority,
  needsDecision,
  nextToBuild,
} from '../src/index.js';

const tool = (over: Partial<CatalogueTool> = {}): CatalogueTool => ({
  id: 'T99',
  category: 'Time and routines',
  name: 'Test tool',
  what: 'Does one small thing.',
  foundIn: 'Somewhere',
  data: 'none',
  priority: 'P1',
  note: '',
  ...over,
});
const wrap = (tools: CatalogueTool[]) => ({
  generated: '2026-11-05',
  tools,
  platforms: [],
});

describe('toolbox catalogue data', () => {
  it('parses the supplied catalogue: 64 tools with unique ids', () => {
    const parsed = ToolboxCatalogue.parse({
      generated: CATALOGUE_GENERATED,
      tools: CATALOGUE_TOOLS,
      platforms: CATALOGUE_PLATFORMS,
    });
    expect(parsed.tools).toHaveLength(64);
    expect(new Set(parsed.tools.map((t) => t.id)).size).toBe(64);
  });

  it('keeps the reviewed counts: 12 built, 17 P1, 18 P2, 10 P3, 7 not to be built', () => {
    expect(countByPriority(CATALOGUE_TOOLS)).toEqual({
      BUILT: 12,
      P1: 17,
      P2: 18,
      P3: 10,
      NO: 7,
    });
  });

  it('never offers a microphone, network, personal or learner-data tool as the next build', () => {
    for (const p of ['P1', 'P2', 'P3'] as const) {
      for (const t of nextToBuild(CATALOGUE_TOOLS, p)) {
        expect(['microphone', 'network', 'personal', 'learner']).not.toContain(t.data);
      }
    }
    expect(needsDecision(CATALOGUE_TOOLS).map((t) => t.id)).toContain('T14');
  });

  it('records why each tool that will not be built was refused', () => {
    for (const t of CATALOGUE_TOOLS.filter((x) => x.priority === 'NO')) {
      expect(t.note.length).toBeGreaterThan(10);
    }
  });
});

describe('toolbox catalogue schema: failure paths', () => {
  it('refuses a priority that is not in the scale', () => {
    expect(CatalogueTool.safeParse({ ...tool(), priority: 'P4' }).success).toBe(false);
  });

  it('refuses a duplicate tool id', () => {
    const r = ToolboxCatalogue.safeParse(wrap([tool(), tool({ name: 'Another one' })]));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain('duplicate tool id T99');
  });

  it('refuses a NO entry with no reason and a BUILT entry with no widget named', () => {
    expect(ToolboxCatalogue.safeParse(wrap([tool({ priority: 'NO' })])).success).toBe(
      false,
    );
    expect(ToolboxCatalogue.safeParse(wrap([tool({ priority: 'BUILT' })])).success).toBe(
      false,
    );
    expect(
      ToolboxCatalogue.safeParse(wrap([tool({ priority: 'BUILT', note: 'TB-W17' })]))
        .success,
    ).toBe(true);
  });

  it('refuses a data kind the platform has not named and a malformed id', () => {
    expect(CatalogueTool.safeParse({ ...tool(), data: 'camera' }).success).toBe(false);
    expect(CatalogueTool.safeParse({ ...tool(), id: 'tool-1' }).success).toBe(false);
  });
});

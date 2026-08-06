import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  ToolRegistry,
  ToolRegistryError,
  bootToolRegistry,
} from '../src/tool-registry.js';

function tool(overrides: Record<string, unknown> = {}): unknown {
  return {
    name: 'release_resource',
    purpose: 'Releases a booked resource back to the pool.',
    inputSchema: z.object({ resourceId: z.string() }),
    idempotent: true,
    sideEffect: 'write',
    ...overrides,
  };
}

describe('ToolRegistry', () => {
  it('registers a valid tool and makes it retrievable', () => {
    const registry = new ToolRegistry();
    const registered = registry.register(tool());

    expect(registered.name).toBe('release_resource');
    expect(registry.has('release_resource')).toBe(true);
    expect(registry.get('release_resource')).toEqual(registered);
    expect(registry.list()).toEqual([registered]);
  });

  it('registers multiple distinct tools', () => {
    const registry = new ToolRegistry();
    registry.register(tool({ name: 'tool_a' }));
    registry.register(tool({ name: 'tool_b' }));
    expect(
      registry
        .list()
        .map((t) => t.name)
        .sort(),
    ).toEqual(['tool_a', 'tool_b']);
  });

  it('refuses a duplicate name and leaves the registry unchanged', () => {
    const registry = new ToolRegistry();
    registry.register(tool());
    expect(() => registry.register(tool())).toThrow(ToolRegistryError);
    expect(registry.list()).toHaveLength(1);
  });

  it('refuses a structurally invalid candidate and registers nothing', () => {
    const registry = new ToolRegistry();
    expect(() => registry.register(tool({ name: '' }))).toThrow(ToolRegistryError);
    expect(registry.list()).toHaveLength(0);
  });

  describe('isIrreversible', () => {
    it('is true for a registered irreversible tool', () => {
      const registry = new ToolRegistry();
      registry.register(tool({ name: 'delete_record', sideEffect: 'irreversible' }));
      expect(registry.isIrreversible('delete_record')).toBe(true);
    });

    it('is false for a registered tool with any other side effect', () => {
      const registry = new ToolRegistry();
      registry.register(tool({ name: 'read_only', sideEffect: 'read' }));
      expect(registry.isIrreversible('read_only')).toBe(false);
    });

    it('is false for a name the registry has never seen', () => {
      const registry = new ToolRegistry();
      expect(registry.isIrreversible('never_registered')).toBe(false);
    });
  });
});

describe('bootToolRegistry', () => {
  it('registers every valid candidate', () => {
    const registry = bootToolRegistry([
      tool({ name: 'tool_a' }),
      tool({ name: 'tool_b', sideEffect: 'irreversible' }),
    ]);
    expect(registry.list()).toHaveLength(2);
    expect(registry.isIrreversible('tool_b')).toBe(true);
  });

  it('throws on the first invalid candidate and registers nothing usable', () => {
    expect(() =>
      bootToolRegistry([tool({ name: 'tool_a' }), tool({ name: '' })]),
    ).toThrow(ToolRegistryError);
  });
});

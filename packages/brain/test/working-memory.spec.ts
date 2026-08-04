import { describe, expect, it, vi } from 'vitest';

import { InMemoryWorkingMemoryStore, promote } from '../src/working-memory.js';

describe('InMemoryWorkingMemoryStore', () => {
  it('remembers and recalls a value scoped to one run', async () => {
    const store = new InMemoryWorkingMemoryStore();
    await store.remember('run-1', 'draft', { text: 'hello' }, 60);
    expect(await store.recall('run-1', 'draft')).toEqual({ text: 'hello' });
  });

  it('does not leak a value into a different run', async () => {
    const store = new InMemoryWorkingMemoryStore();
    await store.remember('run-1', 'draft', 'a', 60);
    expect(await store.recall('run-2', 'draft')).toBeUndefined();
  });

  it('returns undefined for a key that was never stored', async () => {
    const store = new InMemoryWorkingMemoryStore();
    expect(await store.recall('run-1', 'missing')).toBeUndefined();
  });

  it('expires an entry once its TTL has passed', async () => {
    let now = 0;
    const store = new InMemoryWorkingMemoryStore(() => now);
    await store.remember('run-1', 'draft', 'a', 10);
    now += 10_001;
    expect(await store.recall('run-1', 'draft')).toBeUndefined();
  });

  it('does not return an expired entry from recallAll', async () => {
    let now = 0;
    const store = new InMemoryWorkingMemoryStore(() => now);
    await store.remember('run-1', 'fresh', 'a', 60);
    await store.remember('run-1', 'stale', 'b', 1);
    now += 1_001;
    expect(await store.recallAll('run-1')).toEqual({ fresh: 'a' });
  });

  it('recallAll returns an empty object for an unknown run', async () => {
    const store = new InMemoryWorkingMemoryStore();
    expect(await store.recallAll('nonexistent')).toEqual({});
  });

  it('evict discards every entry for a run immediately, regardless of TTL', async () => {
    const store = new InMemoryWorkingMemoryStore();
    await store.remember('run-1', 'draft', 'a', 60);
    await store.evict('run-1');
    expect(await store.recall('run-1', 'draft')).toBeUndefined();
    expect(await store.recallAll('run-1')).toEqual({});
  });

  it('evicting one run leaves another untouched', async () => {
    const store = new InMemoryWorkingMemoryStore();
    await store.remember('run-1', 'draft', 'a', 60);
    await store.remember('run-2', 'draft', 'b', 60);
    await store.evict('run-1');
    expect(await store.recall('run-2', 'draft')).toBe('b');
  });
});

describe('promote', () => {
  it('returns every live entry for the run, without evicting them', async () => {
    const store = new InMemoryWorkingMemoryStore();
    await store.remember('run-1', 'draft', 'a', 60);
    await store.remember('run-1', 'notes', 'b', 60);

    const summary = await promote(store, 'run-1');

    expect(summary.runId).toBe('run-1');
    expect(summary.entries).toEqual({ draft: 'a', notes: 'b' });
    expect(await store.recall('run-1', 'draft')).toBe('a');
  });

  it('stamps a promotion time', async () => {
    const store = new InMemoryWorkingMemoryStore();
    const before = new Date();
    const summary = await promote(store, 'run-1');
    expect(summary.promotedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('summarises an empty run as an empty entry set, not an error', async () => {
    const store = new InMemoryWorkingMemoryStore();
    const summary = await promote(store, 'never-existed');
    expect(summary.entries).toEqual({});
  });
});

describe('a fake WorkingMemoryStore', () => {
  it('promote only calls recallAll, never remember or evict', async () => {
    const store = {
      remember: vi.fn(),
      recall: vi.fn(),
      recallAll: vi.fn().mockResolvedValue({ a: 1 }),
      evict: vi.fn(),
    };
    const summary = await promote(store, 'run-1');
    expect(summary.entries).toEqual({ a: 1 });
    expect(store.recallAll).toHaveBeenCalledWith('run-1');
    expect(store.remember).not.toHaveBeenCalled();
    expect(store.evict).not.toHaveBeenCalled();
  });
});

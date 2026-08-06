import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EvalDiscoveryError,
  loadAllEvalSets,
  loadEvalCasesFromDir,
} from '../src/discovery.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'evals-discovery-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function validCase(id: string, agentId = 'CE-05'): unknown {
  return {
    id,
    agentId,
    input: {},
    context: {},
    expectations: [{ type: 'exact_match', field: 'status', value: 'ok' }],
    tags: [],
    source: 'specification',
  };
}

describe('loadEvalCasesFromDir', () => {
  it('returns an empty array for a directory that does not exist', () => {
    expect(loadEvalCasesFromDir(path.join(dir, 'missing'))).toEqual([]);
  });

  it('loads and validates every case in every *.json file, in filename order', () => {
    writeFileSync(path.join(dir, 'b.json'), JSON.stringify([validCase('b1')]));
    writeFileSync(
      path.join(dir, 'a.json'),
      JSON.stringify([validCase('a1'), validCase('a2')]),
    );
    const cases = loadEvalCasesFromDir(dir);
    expect(cases.map((c) => c.id)).toEqual(['a1', 'a2', 'b1']);
  });

  it('ignores non-json files', () => {
    writeFileSync(path.join(dir, 'README.md'), '# not a case file');
    writeFileSync(path.join(dir, 'a.json'), JSON.stringify([validCase('a1')]));
    expect(loadEvalCasesFromDir(dir).map((c) => c.id)).toEqual(['a1']);
  });

  it('throws EvalDiscoveryError when a file is not a JSON array', () => {
    writeFileSync(path.join(dir, 'bad.json'), JSON.stringify({ not: 'an array' }));
    expect(() => loadEvalCasesFromDir(dir)).toThrow(EvalDiscoveryError);
  });

  it('throws EvalDiscoveryError naming the file and index when a case fails validation', () => {
    writeFileSync(path.join(dir, 'bad.json'), JSON.stringify([{ id: 'x' }]));
    expect(() => loadEvalCasesFromDir(dir)).toThrow(/bad\.json\[0\]/);
  });
});

describe('loadAllEvalSets', () => {
  it('returns an empty map for a sets root that does not exist', () => {
    expect(loadAllEvalSets(path.join(dir, 'missing')).size).toBe(0);
  });

  it('loads one set per subdirectory, keyed by directory name', () => {
    mkdirSync(path.join(dir, 'CE-05'));
    mkdirSync(path.join(dir, 'CE-06'));
    writeFileSync(
      path.join(dir, 'CE-05', 'cases.json'),
      JSON.stringify([validCase('a', 'CE-05')]),
    );
    writeFileSync(
      path.join(dir, 'CE-06', 'cases.json'),
      JSON.stringify([validCase('b', 'CE-06')]),
    );

    const sets = loadAllEvalSets(dir);
    expect([...sets.keys()].sort()).toEqual(['CE-05', 'CE-06']);
    expect(sets.get('CE-05')?.[0]?.id).toBe('a');
  });

  it('ignores files directly under the sets root, only descending into directories', () => {
    writeFileSync(path.join(dir, 'stray.json'), JSON.stringify([validCase('x')]));
    expect(loadAllEvalSets(dir).size).toBe(0);
  });
});

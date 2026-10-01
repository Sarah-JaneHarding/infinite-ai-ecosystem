import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AGE_APPROPRIATENESS_ENTRIES } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import {
  LabelledCase,
  LabelledCoverage,
  checkLabelledSet,
} from '../src/age-appropriateness-labelled-set.js';

const dir = new URL('../calibration/age-appropriateness/', import.meta.url);
const read = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(name, dir)), 'utf8'));

const cases = LabelledCase.array().parse(read('cases.json'));
const coverage = LabelledCoverage.parse(read('coverage.json'));
const entries = AGE_APPROPRIATENESS_ENTRIES;
const key = (n: number): string => `age-appropriateness-${String(n).padStart(3, '0')}`;

const first = (kind: 'violation' | 'conformant' | 'control'): LabelledCase => {
  const c = cases.find((x) => x.kind === kind);
  if (c === undefined) throw new Error(`no ${kind} case`);
  return c;
};

describe('the shipped labelled set', () => {
  it('is consistent with itself and with the ratified clauses', () => {
    expect(entries).toHaveLength(206);
    expect(checkLabelledSet(cases, coverage, entries)).toEqual([]);
  });

  it('is constructed and unreviewed — it claims no human label', () => {
    expect(cases.every((c) => c.labelledBy === 'constructed')).toBe(true);
    expect(cases.every((c) => c.review.status === 'unreviewed')).toBe(true);
  });

  it('pairs every tested clause as violation + conformant, and carries the three controls', () => {
    expect(Object.keys(coverage.tested)).toHaveLength(14);
    expect(cases.filter((c) => c.kind === 'violation')).toHaveLength(14);
    expect(cases.filter((c) => c.kind === 'conformant')).toHaveLength(14);
    expect(
      cases.filter((c) => c.kind === 'control').map((c) => c.expectedAppropriate),
    ).toEqual([true, true, false]);
  });

  it('flags the Grade R jigsaw benchmarks as conflicting and tests neither', () => {
    expect(coverage.conflicting[0]?.clauses).toEqual([key(26), key(51)]);
    expect(coverage.tested[key(26)]).toBeUndefined();
    expect(coverage.tested[key(51)]).toBeUndefined();
  });
});

describe('LabelledCase', () => {
  it('rejects a violation expected to pass, and a conformant expected to fail', () => {
    expect(
      LabelledCase.safeParse({ ...first('violation'), expectedAppropriate: true })
        .success,
    ).toBe(false);
    expect(
      LabelledCase.safeParse({ ...first('conformant'), expectedAppropriate: false })
        .success,
    ).toBe(false);
  });

  it('rejects a control that cites a clause, and a non-control that cites none', () => {
    expect(
      LabelledCase.safeParse({ ...first('control'), drivingClauses: [key(1)] }).success,
    ).toBe(false);
    expect(
      LabelledCase.safeParse({ ...first('violation'), drivingClauses: [] }).success,
    ).toBe(false);
  });

  it('rejects a non-control that withholds the clauses', () => {
    expect(
      LabelledCase.safeParse({ ...first('violation'), clauseSet: 'empty' }).success,
    ).toBe(false);
  });

  it('ties the reviewer to the review status', () => {
    const review = { status: 'confirmed', reviewer: null, reviewedOn: null, note: null };
    expect(LabelledCase.safeParse({ ...first('violation'), review }).success).toBe(false);
    const done = { ...review, reviewer: 'A. Teacher', reviewedOn: '2026-10-02' };
    expect(LabelledCase.safeParse({ ...first('violation'), review: done }).success).toBe(
      true,
    );
    const odd = { ...done, status: 'unreviewed' };
    expect(LabelledCase.safeParse({ ...first('violation'), review: odd }).success).toBe(
      false,
    );
  });
});

describe('checkLabelledSet', () => {
  const problems = (c: readonly LabelledCase[], v = coverage): string[] =>
    checkLabelledSet(c, v, entries);
  const violation = first('violation');

  it('reports a duplicate case id', () => {
    expect(problems([...cases, violation]).join('\n')).toContain('duplicate case id');
  });

  it('reports a cited clause that does not exist', () => {
    const bad = { ...violation, drivingClauses: [key(999)] };
    expect(problems([bad]).join('\n')).toContain('not a ratified clause');
  });

  it('reports a clause from a different phase than the case', () => {
    const bad = { ...violation, phase: 'SENIOR' as const };
    expect(problems([bad]).join('\n')).toContain('case is SENIOR');
  });

  it('reports coverage that names an unknown clause, case, or a case that does not cite it', () => {
    const cov = LabelledCoverage.parse({
      tested: { [key(999)]: ['nope'], [key(97)]: [violation.id] },
      ambiguous: [],
      conflicting: [],
    });
    const out = problems(cases, cov).join('\n');
    expect(out).toContain(`${key(999)} is not a ratified clause`);
    expect(out).toContain('unknown case nope');
    expect(out).toContain(`${violation.id} does not cite ${key(97)}`);
  });

  it('reports a tested clause without both a violation and a conformant case', () => {
    const only = LabelledCoverage.parse({
      tested: { [violation.drivingClauses[0] ?? '']: [violation.id] },
      ambiguous: [],
      conflicting: [],
    });
    expect(problems([violation], only).join('\n')).toContain(
      'needs both a violation and a conformant',
    );
  });

  it('reports a cited clause that coverage does not list', () => {
    const empty = LabelledCoverage.parse({ tested: {}, ambiguous: [], conflicting: [] });
    expect(problems([violation], empty).join('\n')).toContain(
      'coverage does not list it',
    );
  });

  it('reports a flagged clause that is unknown, or both tested and flagged', () => {
    const tested = violation.drivingClauses[0] ?? '';
    const cov = LabelledCoverage.parse({
      tested: coverage.tested,
      ambiguous: [{ clause: key(999), reason: 'x' }],
      conflicting: [{ clauses: [tested, key(1)], reason: 'y' }],
    });
    const out = problems(cases, cov).join('\n');
    expect(out).toContain(`flagged ${key(999)} is not a ratified clause`);
    expect(out).toContain(`${tested} is both tested and flagged`);
  });
});

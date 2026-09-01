'use client';

import { useState } from 'react';

// EGRA: Early Grade Reading Assessment — 7 subtests used in SA Foundation/Intermediate Phase literacy screening.
// Benchmarks sourced from the EGRA MTSS Data System reference (docs/examples/mod-02-analytics/).

const GRADES = [
  'Grade R',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
] as const;
type Grade = (typeof GRADES)[number];

interface Subtest {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly max: number;
  readonly benchmarks: Partial<Record<Grade, number>>;
}

const SUBTESTS: readonly Subtest[] = [
  {
    id: 'LSI',
    label: 'Letter Sound Identification',
    unit: 'correct/min',
    max: 100,
    benchmarks: {
      'Grade 1': 54,
      'Grade 2': 72,
      'Grade 3': 80,
      'Grade 4': 80,
      'Grade 5': 80,
      'Grade 6': 80,
    },
  },
  {
    id: 'PA',
    label: 'Phonological Awareness',
    unit: '% correct',
    max: 100,
    benchmarks: {
      'Grade R': 60,
      'Grade 1': 70,
      'Grade 2': 80,
      'Grade 3': 80,
      'Grade 4': 80,
      'Grade 5': 80,
      'Grade 6': 80,
    },
  },
  {
    id: 'NWF',
    label: 'Nonsense Word Fluency (Decoding)',
    unit: 'correct/min',
    max: 100,
    benchmarks: {
      'Grade 2': 30,
      'Grade 3': 50,
      'Grade 4': 60,
      'Grade 5': 60,
      'Grade 6': 60,
    },
  },
  {
    id: 'WR',
    label: 'Word Reading',
    unit: 'correct/min',
    max: 100,
    benchmarks: {
      'Grade 2': 40,
      'Grade 3': 60,
      'Grade 4': 70,
      'Grade 5': 80,
      'Grade 6': 80,
    },
  },
  {
    id: 'ORF',
    label: 'Oral Reading Fluency',
    unit: 'WCPM',
    max: 200,
    benchmarks: {
      'Grade 2': 45,
      'Grade 3': 90,
      'Grade 4': 100,
      'Grade 5': 110,
      'Grade 6': 120,
    },
  },
  {
    id: 'LC',
    label: 'Listening Comprehension',
    unit: '% correct',
    max: 100,
    benchmarks: {
      'Grade R': 70,
      'Grade 1': 70,
      'Grade 2': 75,
      'Grade 3': 80,
      'Grade 4': 80,
      'Grade 5': 80,
      'Grade 6': 80,
    },
  },
  {
    id: 'RC',
    label: 'Reading Comprehension',
    unit: '% correct',
    max: 100,
    benchmarks: {
      'Grade 3': 70,
      'Grade 4': 75,
      'Grade 5': 80,
      'Grade 6': 80,
    },
  },
];

function tierFromFlags(flags: number): 1 | 2 | 3 {
  if (flags === 0) return 1;
  if (flags <= 2) return 2;
  return 3;
}

const TIER_LABEL: Record<1 | 2 | 3, { label: string; bg: string; text: string }> = {
  1: { label: 'Tier 1 — On track', bg: '#dcfce7', text: '#166534' },
  2: { label: 'Tier 2 — Strategic support recommended', bg: '#fef9c3', text: '#854d0e' },
  3: {
    label: 'Tier 3 — Intensive intervention recommended',
    bg: '#fee2e2',
    text: '#991b1b',
  },
};

export function EgraScreeningView() {
  const [grade, setGrade] = useState<Grade>('Grade 2');
  const [scores, setScores] = useState<Partial<Record<string, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const setScore = (id: string, val: string) => {
    setScores((prev) => ({ ...prev, [id]: val }));
    setSubmitted(false);
  };

  const applicableSubtests = SUBTESTS.filter((s) => grade in s.benchmarks);

  const flaggedSubtests = applicableSubtests.filter((s) => {
    const raw = scores[s.id];
    if (!raw || raw.trim() === '') return false;
    const val = Number(raw);
    const bench = s.benchmarks[grade];
    return bench !== undefined && val < bench;
  });

  const tier = submitted ? tierFromFlags(flaggedSubtests.length) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div
        className="rounded-[var(--iai-radius-xl)] border p-5"
        style={{ borderColor: 'var(--iai-border)', background: 'var(--iai-bg)' }}
      >
        <p
          className="text-sm font-semibold mb-0.5"
          style={{ color: 'var(--iai-text)', fontFamily: 'var(--iai-font-title)' }}
        >
          EGRA Universal Screening
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--iai-text-subtle)' }}>
          Enter subtest scores for a de-identified learner token. No personal information
          is captured here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Grade selector */}
          <div>
            <label
              htmlFor="egra-grade"
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--iai-text)' }}
            >
              Learner grade
            </label>
            <select
              id="egra-grade"
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value as Grade);
                setScores({});
                setSubmitted(false);
              }}
              className="w-full rounded-[var(--iai-radius-md)] border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--iai-border)',
                background: 'var(--iai-bg)',
                color: 'var(--iai-text)',
              }}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Subtest inputs */}
          <div className="space-y-3">
            {applicableSubtests.map((s) => {
              const bench = s.benchmarks[grade];
              const raw = scores[s.id] ?? '';
              const val = raw !== '' ? Number(raw) : null;
              const isBelowBench = bench !== undefined && val !== null && val < bench;

              return (
                <div key={s.id}>
                  <label
                    htmlFor={`subtest-${s.id}`}
                    className="flex items-center justify-between text-xs font-semibold mb-1"
                  >
                    <span style={{ color: 'var(--iai-text)' }}>
                      {s.id} — {s.label}
                    </span>
                    {bench !== undefined && (
                      <span
                        className="font-normal"
                        style={{
                          color: 'var(--iai-text-subtle)',
                          fontFamily: 'var(--iai-font-mono)',
                        }}
                      >
                        benchmark ≥ {bench} {s.unit}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`subtest-${s.id}`}
                      type="number"
                      min={0}
                      max={s.max}
                      step={s.unit.includes('%') ? 1 : 0.5}
                      value={raw}
                      onChange={(e) => setScore(s.id, e.target.value)}
                      placeholder={`0 – ${s.max}`}
                      className="flex-1 rounded-[var(--iai-radius-md)] border px-3 py-2 text-sm"
                      style={{
                        borderColor: isBelowBench
                          ? 'var(--iai-red)'
                          : 'var(--iai-border)',
                        background: 'var(--iai-bg)',
                        color: 'var(--iai-text)',
                      }}
                    />
                    <span
                      className="text-xs w-24 shrink-0"
                      style={{
                        color: isBelowBench ? 'var(--iai-red)' : 'var(--iai-text-subtle)',
                        fontFamily: 'var(--iai-font-mono)',
                      }}
                    >
                      {s.unit}
                      {isBelowBench && ' ⚠'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-[var(--iai-radius-md)] text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--iai-blue)' }}
          >
            Calculate tier recommendation
          </button>
        </form>
      </div>

      {/* Result panel */}
      {submitted && tier !== null && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--iai-radius-xl)] border p-5"
          style={{
            background: TIER_LABEL[tier].bg,
            borderColor: 'transparent',
            color: TIER_LABEL[tier].text,
          }}
        >
          <p className="font-semibold">{TIER_LABEL[tier].label}</p>
          {flaggedSubtests.length > 0 ? (
            <p className="text-sm mt-1">
              Below benchmark on: {flaggedSubtests.map((s) => s.id).join(', ')}
            </p>
          ) : (
            <p className="text-sm mt-1">
              All applicable subtests meet or exceed grade benchmark.
            </p>
          )}
          <p className="text-xs mt-2 opacity-75">
            This is a screening recommendation only. The SBST must confirm placement
            through the SIAS process before any intervention is formalised.
          </p>
        </div>
      )}
    </div>
  );
}

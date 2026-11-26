'use client';

import { useState } from 'react';

import { SUBTESTS, STATUS_TEXT, evaluateAll, type SubtestStatus } from './egra-screening';

// EGRA: Early Grade Reading Assessment — a calculator that lays the scores you enter beside
// the benchmarks YOU enter. It ships no benchmark and recommends no tier (OQ-035, decided
// 2026-11-05): EGRA has no single fixed cut-score, and the SBST person assigns the tier
// through the SIAS process. Nothing is stored. Logic lives in `egra-screening.ts`.

const STATUS_STYLE: Readonly<Record<SubtestStatus, { color: string }>> = {
  'not-entered': { color: 'var(--iai-text-subtle)' },
  'invalid-score': { color: 'var(--iai-red)' },
  'no-benchmark': { color: 'var(--iai-text-subtle)' },
  'invalid-benchmark': { color: 'var(--iai-red)' },
  meets: { color: 'var(--iai-text)' },
  below: { color: 'var(--iai-red)' },
};

const inputClass = 'rounded-[var(--iai-radius-md)] border px-3 py-2 text-sm';
const inputStyle = {
  borderColor: 'var(--iai-border)',
  background: 'var(--iai-bg)',
  color: 'var(--iai-text)',
} as const;

export function EgraScreeningView() {
  const [scores, setScores] = useState<Partial<Record<string, string>>>({});
  const [benchmarks, setBenchmarks] = useState<Partial<Record<string, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const results = evaluateAll(scores, benchmarks);

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
        <p className="text-xs mb-2" style={{ color: 'var(--iai-text-subtle)' }}>
          Enter each subtest score for a de-identified learner token, and the benchmark
          your school uses for that learner&apos;s grade. No personal information is
          captured here and nothing is saved.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--iai-text-subtle)' }}>
          This tool does not supply benchmarks and does not recommend a support tier. The
          SBST decides the tier through the SIAS process.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-3">
            {SUBTESTS.map((s) => (
              <div key={s.id}>
                <p
                  className="text-xs font-semibold mb-1"
                  style={{ color: 'var(--iai-text)' }}
                >
                  {s.id} — {s.label}{' '}
                  <span
                    className="font-normal"
                    style={{
                      color: 'var(--iai-text-subtle)',
                      fontFamily: 'var(--iai-font-mono)',
                    }}
                  >
                    ({s.unit})
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <label htmlFor={`score-${s.id}`} className="sr-only">
                    {s.id} score
                  </label>
                  <input
                    id={`score-${s.id}`}
                    type="text"
                    inputMode="decimal"
                    value={scores[s.id] ?? ''}
                    onChange={(e) => {
                      setScores((prev) => ({ ...prev, [s.id]: e.target.value }));
                      setSubmitted(false);
                    }}
                    placeholder="Score"
                    className={`flex-1 ${inputClass}`}
                    style={inputStyle}
                  />
                  <label htmlFor={`benchmark-${s.id}`} className="sr-only">
                    {s.id} benchmark
                  </label>
                  <input
                    id={`benchmark-${s.id}`}
                    type="text"
                    inputMode="decimal"
                    value={benchmarks[s.id] ?? ''}
                    onChange={(e) => {
                      setBenchmarks((prev) => ({ ...prev, [s.id]: e.target.value }));
                      setSubmitted(false);
                    }}
                    placeholder="School benchmark"
                    className={`flex-1 ${inputClass}`}
                    style={inputStyle}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-[var(--iai-radius-md)] text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--iai-blue)' }}
          >
            Compare scores to my benchmarks
          </button>
        </form>
      </div>

      {submitted && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[var(--iai-radius-xl)] border p-5"
          style={{ borderColor: 'var(--iai-border)', background: 'var(--iai-bg)' }}
        >
          <p className="font-semibold text-sm mb-2" style={{ color: 'var(--iai-text)' }}>
            Scores against the benchmarks you entered
          </p>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.id} style={STATUS_STYLE[r.status]}>
                <span style={{ fontFamily: 'var(--iai-font-mono)' }}>{r.id}</span> —{' '}
                {STATUS_TEXT[r.status]}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-3" style={{ color: 'var(--iai-text-subtle)' }}>
            This is a comparison only, not a recommendation. A subtest with no score, or
            no valid benchmark, has no result. The SBST assigns any tier through the SIAS
            process.
          </p>
        </div>
      )}
    </div>
  );
}

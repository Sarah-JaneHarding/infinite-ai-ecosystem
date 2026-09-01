'use client';

import { useState } from 'react';

export interface CurriculumRow {
  week: number;
  lessonNumber: number;
  topic: string;
  walt: string;
  successCriteria: string;
  faTechnique: string;
  activity: string;
  resources: string;
  term: 1 | 2 | 3 | 4;
}

interface CurriculumMapViewProps {
  subject: string;
  grade: string;
  academicYear: number;
  rows: CurriculumRow[];
}

const TERM_COLOURS: Record<number, string> = {
  1: '#1565c0',
  2: '#2db24c',
  3: '#f47920',
  4: '#7b2fbe',
};

export function CurriculumMapView({
  subject,
  grade,
  academicYear,
  rows,
}: CurriculumMapViewProps) {
  const [activeTerm, setActiveTerm] = useState<1 | 2 | 3 | 4 | 'all'>('all');

  const visible = activeTerm === 'all' ? rows : rows.filter((r) => r.term === activeTerm);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)]">
            MOD-01 · Curriculum Engine
          </p>
          <h2
            className="text-xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            {subject} — {grade} · {academicYear}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 1, 2, 3, 4] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTerm(t)}
              style={
                activeTerm === t && t !== 'all'
                  ? {
                      background: TERM_COLOURS[t as number],
                      color: '#fff',
                      borderColor: TERM_COLOURS[t as number],
                    }
                  : activeTerm === t
                    ? {
                        background: 'var(--iai-text)',
                        color: '#fff',
                        borderColor: 'var(--iai-text)',
                      }
                    : {}
              }
              className={[
                'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                activeTerm !== t
                  ? 'border-[var(--iai-border)] text-[var(--iai-text)] hover:border-[var(--iai-text)]'
                  : '',
              ].join(' ')}
            >
              {t === 'all' ? 'All Terms' : `Term ${t}`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--iai-border)]">
        <table className="w-full text-sm border-collapse" role="table">
          <thead>
            <tr className="bg-[var(--iai-surface-raised)] text-[var(--iai-text-subtle)]">
              {[
                'Wk',
                'L#',
                'Topic',
                'WALT',
                'Success Criteria',
                'FA Technique',
                'Activity',
                'Resources',
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="text-left text-xs font-semibold uppercase tracking-wide px-3 py-2.5 border-b border-[var(--iai-border)] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-10 text-[var(--iai-text-subtle)] text-sm"
                >
                  No curriculum rows for this selection.
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--iai-border)] hover:bg-[var(--iai-surface-raised)] transition-colors"
                >
                  <td
                    className="px-3 py-2 font-mono text-xs font-bold whitespace-nowrap"
                    style={{ color: TERM_COLOURS[row.term] }}
                  >
                    {row.week}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--iai-text-subtle)]">
                    L{row.lessonNumber}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--iai-text)] max-w-[160px]">
                    {row.topic}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text)] max-w-[200px] leading-snug">
                    {row.walt}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] max-w-[180px] leading-snug">
                    {row.successCriteria}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 rounded bg-[var(--iai-surface-raised)] text-xs font-medium text-[var(--iai-text)]">
                      {row.faTechnique}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] max-w-[200px] leading-snug">
                    {row.activity}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] max-w-[140px] text-xs">
                    {row.resources}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--iai-text-subtle)]">
        {visible.length} lesson{visible.length !== 1 ? 's' : ''} shown
        {activeTerm !== 'all' ? ` · Term ${activeTerm}` : ' · All terms'}
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  formatWeeks,
  gradeLabel,
  type AtpYearGroup,
  type CurriculumMapData,
  type Term,
} from '@/lib/atp-curriculum';

interface CurriculumMapViewProps {
  readonly data: CurriculumMapData;
}

const TERM_COLOURS: Record<number, string> = {
  1: 'var(--iai-blue)',
  2: 'var(--iai-green)',
  3: 'var(--iai-orange)',
  4: 'var(--iai-violet)',
};

type TermFilter = Term | 'all';

const SELECT_CLASS =
  'rounded-md border border-[var(--iai-border)] bg-[var(--iai-bg)] px-2.5 py-1.5 text-sm text-[var(--iai-text)]';

export function CurriculumMapView({ data }: CurriculumMapViewProps) {
  const [activeTerm, setActiveTerm] = useState<TermFilter>('all');
  const { catalogue, selection, groups, skipped } = data;
  // The grade being picked in the form (not yet submitted) decides which subjects are listed.
  const [pickedGrade, setPickedGrade] = useState(selection?.grade ?? '');

  if (selection === null) {
    return (
      <div>
        <Heading title="Curriculum Map" />
        <p
          role="status"
          className="rounded-lg border border-[var(--iai-border)] px-4 py-10 text-center text-sm text-[var(--iai-text-subtle)]"
        >
          No curriculum data has been loaded for your school yet. Ask your school
          administrator to ingest and ratify the Annual Teaching Plans.
        </p>
        {skipped > 0 ? <SkippedNote skipped={skipped} /> : null}
      </div>
    );
  }

  const subjects = catalogue.subjectsByGrade[pickedGrade] ?? [];

  return (
    <div>
      <Heading title={`${selection.subject} — ${gradeLabel(selection.grade)}`} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--iai-text-subtle)]">
          Grade
          <select
            name="grade"
            value={pickedGrade}
            onChange={(e) => setPickedGrade(e.target.value)}
            className={SELECT_CLASS}
          >
            {catalogue.grades.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--iai-text-subtle)]">
          Subject
          <select
            name="subject"
            key={pickedGrade}
            defaultValue={
              pickedGrade === selection.grade ? selection.subject : subjects[0]
            }
            className={SELECT_CLASS}
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--iai-text)] px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Show
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 1, 2, 3, 4] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTerm(t)}
            aria-pressed={activeTerm === t}
            style={
              activeTerm === t
                ? t === 'all'
                  ? {
                      background: 'var(--iai-text)',
                      color: 'white',
                      borderColor: 'var(--iai-text)',
                    }
                  : {
                      background: TERM_COLOURS[t],
                      color: 'white',
                      borderColor: TERM_COLOURS[t],
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

      {groups.length > 1 ? (
        <p
          role="note"
          className="mb-4 rounded-lg border border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] px-3 py-2 text-xs text-[var(--iai-text)]"
        >
          This grade and subject has Annual Teaching Plans from {groups.length} different
          years, shown separately below. Which one applies is a decision for your school;
          this page does not choose between them.
        </p>
      ) : null}

      {groups.map((group) => (
        <YearSection key={group.atpYear} group={group} term={activeTerm} />
      ))}

      <p className="mt-4 text-xs text-[var(--iai-text-subtle)]">
        This is the Annual Teaching Plan: pacing, content areas and formal assessment
        tasks. Lesson-level detail (learning intentions, success criteria, activities,
        resources) is not part of the ATP; it belongs to lesson plans, which this view
        does not read yet.
      </p>
      {skipped > 0 ? <SkippedNote skipped={skipped} /> : null}
    </div>
  );
}

function Heading({ title }: { readonly title: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)]">
        MOD-01 · Curriculum Engine
      </p>
      <h2
        className="text-xl font-bold text-[var(--iai-text)]"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        {title}
      </h2>
    </div>
  );
}

function SkippedNote({ skipped }: { readonly skipped: number }) {
  return (
    <p role="note" className="mt-2 text-xs text-[var(--iai-text-subtle)]">
      {skipped} curriculum document{skipped === 1 ? '' : 's'} could not be read and{' '}
      {skipped === 1 ? 'was' : 'were'} left out.
    </p>
  );
}

const TH_CLASS =
  'text-left text-xs font-semibold uppercase tracking-wide px-3 py-2.5 border-b border-[var(--iai-border)] whitespace-nowrap';

function YearSection({
  group,
  term,
}: {
  readonly group: AtpYearGroup;
  readonly term: TermFilter;
}) {
  const topics =
    term === 'all' ? group.topics : group.topics.filter((t) => t.term === term);
  const fats = term === 'all' ? group.fats : group.fats.filter((f) => f.term === term);

  return (
    <section aria-label={`ATP ${group.atpYear}`} className="mb-8">
      <h3 className="mb-2 text-sm font-bold text-[var(--iai-text)]">
        ATP {group.atpYear}
      </h3>

      <div className="overflow-x-auto rounded-lg border border-[var(--iai-border)]">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">
            Topics by term and week, ATP {group.atpYear}
          </caption>
          <thead>
            <tr className="bg-[var(--iai-surface-raised)] text-[var(--iai-text-subtle)]">
              {['Term', 'Weeks', 'Topic', 'Content area', 'Assessment'].map((h) => (
                <th key={h} scope="col" className={TH_CLASS}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topics.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-[var(--iai-text-subtle)]"
                >
                  No topics for this selection.
                </td>
              </tr>
            ) : (
              topics.map((row, i) => (
                <tr
                  key={`${row.term}-${row.weekStart}-${i}`}
                  className="border-b border-[var(--iai-border)] hover:bg-[var(--iai-surface-raised)] transition-colors"
                >
                  <td
                    className="px-3 py-2 font-mono text-xs font-bold whitespace-nowrap"
                    style={{ color: TERM_COLOURS[row.term] }}
                  >
                    T{row.term}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-[var(--iai-text-subtle)]">
                    {formatWeeks(row)}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--iai-text)] leading-snug">
                    {row.topic}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] leading-snug">
                    {row.contentArea}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text)]">
                    {row.assessmentType ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--iai-text-subtle)]">
        {topics.length} topic{topics.length === 1 ? '' : 's'} shown
        {term === 'all' ? ' · All terms' : ` · Term ${term}`}
      </p>

      {fats.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--iai-border)]">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Formal assessment tasks, ATP {group.atpYear}
            </caption>
            <thead>
              <tr className="bg-[var(--iai-surface-raised)] text-[var(--iai-text-subtle)]">
                {['Term', 'FAT', 'Type', 'Description'].map((h) => (
                  <th key={h} scope="col" className={TH_CLASS}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fats.map((fat, i) => (
                <tr
                  key={`${fat.term}-${fat.fatNumber ?? 'x'}-${i}`}
                  className="border-b border-[var(--iai-border)]"
                >
                  <td
                    className="px-3 py-2 font-mono text-xs font-bold whitespace-nowrap"
                    style={{ color: TERM_COLOURS[fat.term] }}
                  >
                    T{fat.term}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--iai-text-subtle)]">
                    {fat.fatNumber ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text)]">{fat.fatType}</td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] leading-snug">
                    {fat.fatDescription ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <details className="mt-3 text-xs text-[var(--iai-text-subtle)]">
        <summary className="cursor-pointer font-semibold">
          Source documents ({group.sources.length})
        </summary>
        <ul className="mt-1 list-disc pl-5">
          {group.sources.map((s) => (
            <li key={s.documentId}>
              {s.description} · <span className="font-mono">{s.documentId}</span>
              {s.documentVersion !== null ? ` · v${s.documentVersion}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

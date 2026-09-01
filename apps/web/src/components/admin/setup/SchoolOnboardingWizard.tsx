'use client';

import { useState } from 'react';
import {
  ALL_GRADES,
  CAPS_SUBJECTS,
  SA_LANGUAGES,
  STAFF_ROLES,
  periodsFromHours,
  validateLanguageConflicts,
} from '@infinite-ai/school-setup';
import type {
  LanguageSettings,
  StaffMember,
  SubjectGradePeriods,
  TermWeeks,
} from '@infinite-ai/school-setup';

const STEPS = [
  { id: 1, label: 'Language Settings' },
  { id: 2, label: 'Term Weeks' },
  { id: 3, label: 'CAPS Subjects' },
  { id: 4, label: 'Grades & Periods' },
  { id: 5, label: 'Staff' },
] as const;

type WizardState = {
  languages: Partial<LanguageSettings>;
  termWeeks: Partial<TermWeeks>;
  selectedSubjects: string[];
  subjectConfig: SubjectGradePeriods[];
  staff: StaffMember[];
};

export function SchoolOnboardingWizard() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    languages: {},
    termWeeks: {},
    selectedSubjects: [],
    subjectConfig: [],
    staff: [],
  });
  const [saved, setSaved] = useState(false);

  const langConflict =
    state.languages.lolt && state.languages.fal
      ? validateLanguageConflicts({
          lolt: state.languages.lolt,
          fal: state.languages.fal,
          sal: state.languages.sal,
        })
      : null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress stepper */}
      <nav aria-label="Setup progress" className="mb-8">
        <ol className="flex gap-0">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex-1 flex items-center">
              <button
                onClick={() => step > s.id && setStep(s.id)}
                disabled={step < s.id}
                aria-current={step === s.id ? 'step' : undefined}
                className={[
                  'flex flex-col items-center gap-1 w-full text-xs font-semibold transition-colors',
                  step === s.id
                    ? 'text-[var(--iai-accent)]'
                    : step > s.id
                      ? 'text-[var(--iai-text-subtle)] cursor-pointer'
                      : 'text-[var(--iai-border)] cursor-default',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2',
                    step === s.id
                      ? 'border-[var(--iai-accent)] text-[var(--iai-accent)] bg-[var(--iai-surface)]'
                      : step > s.id
                        ? 'border-[var(--iai-text-subtle)] text-[var(--iai-surface)] bg-[var(--iai-text-subtle)]'
                        : 'border-[var(--iai-border)] text-[var(--iai-border)]',
                  ].join(' ')}
                >
                  {step > s.id ? '✓' : s.id}
                </span>
                <span className="hidden sm:block text-center leading-tight">
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'h-0.5 flex-1 mx-1',
                    step > s.id
                      ? 'bg-[var(--iai-text-subtle)]'
                      : 'bg-[var(--iai-border)]',
                  ].join(' ')}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step 1 — Language Settings */}
      {step === 1 && (
        <StepCard
          title="🌍 Language Settings"
          subtitle="Set the language of instruction and additional languages offered at your school."
        >
          <div className="space-y-4">
            <Field label="Language of Learning & Teaching (LOLT)">
              <select
                className="input-base"
                value={state.languages.lolt ?? ''}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    languages: {
                      ...s.languages,
                      lolt: e.target.value as LanguageSettings['lolt'],
                    },
                  }))
                }
              >
                <option value="">— Select LOLT —</option>
                {SA_LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field
              label="First Additional Language(s) (FAL)"
              hint="Select all that apply"
            >
              <div className="flex flex-wrap gap-2">
                {SA_LANGUAGES.map((l) => (
                  <LangChip
                    key={l}
                    lang={l}
                    selected={state.languages.fal?.includes(l) ?? false}
                    onToggle={() =>
                      setState((s) => {
                        const fal = s.languages.fal ?? [];
                        return {
                          ...s,
                          languages: {
                            ...s.languages,
                            fal: fal.includes(l)
                              ? fal.filter((x) => x !== l)
                              : [...fal, l],
                          },
                        };
                      })
                    }
                  />
                ))}
              </div>
            </Field>
            {langConflict && (
              <p role="alert" className="text-sm text-red-600">
                {langConflict}
              </p>
            )}
          </div>
          <StepNav
            onNext={() => setStep(2)}
            nextDisabled={
              !state.languages.lolt || !state.languages.fal?.length || !!langConflict
            }
          />
        </StepCard>
      )}

      {/* Step 2 — Term Weeks */}
      {step === 2 && (
        <StepCard
          title="📅 Term Weeks"
          subtitle="Enter the number of teaching weeks in each term."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['term1', 'term2', 'term3', 'term4'] as const).map((t, i) => (
              <Field key={t} label={`Term ${i + 1}`}>
                <input
                  type="number"
                  min={1}
                  max={13}
                  className="input-base"
                  placeholder={['10', '10', '11', '7'][i]}
                  value={state.termWeeks[t] ?? ''}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      termWeeks: { ...s.termWeeks, [t]: Number(e.target.value) },
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            nextDisabled={
              !state.termWeeks.term1 ||
              !state.termWeeks.term2 ||
              !state.termWeeks.term3 ||
              !state.termWeeks.term4
            }
          />
        </StepCard>
      )}

      {/* Step 3 — CAPS Subjects */}
      {step === 3 && (
        <StepCard
          title="📚 CAPS Subjects"
          subtitle="Select every CAPS subject offered at your school."
        >
          <div className="flex flex-wrap gap-2">
            {CAPS_SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    selectedSubjects: prev.selectedSubjects.includes(s)
                      ? prev.selectedSubjects.filter((x) => x !== s)
                      : [...prev.selectedSubjects, s],
                  }))
                }
                className={[
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  state.selectedSubjects.includes(s)
                    ? 'bg-[var(--iai-accent)] text-white border-[var(--iai-accent)]'
                    : 'bg-[var(--iai-surface)] text-[var(--iai-text)] border-[var(--iai-border)] hover:border-[var(--iai-accent)]',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-[var(--iai-text-subtle)]">
            {state.selectedSubjects.length} subject
            {state.selectedSubjects.length !== 1 ? 's' : ''} selected
          </p>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              setState((s) => ({
                ...s,
                subjectConfig: s.selectedSubjects.map((sub) => ({
                  subject: sub,
                  grades: [],
                  hoursPerWeek: 4,
                })),
              }));
              setStep(4);
            }}
            nextDisabled={state.selectedSubjects.length === 0}
          />
        </StepCard>
      )}

      {/* Step 4 — Grades & Periods */}
      {step === 4 && (
        <StepCard
          title="🏫 Grades & Periods"
          subtitle="For each subject, select which grades take it and enter hours per week."
        >
          <div className="space-y-4">
            {state.subjectConfig.map((sc, idx) => (
              <div
                key={sc.subject}
                className="border border-[var(--iai-border)] rounded-lg p-4"
              >
                <h3 className="font-semibold text-sm mb-2">{sc.subject}</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ALL_GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          subjectConfig: s.subjectConfig.map((c, i) =>
                            i === idx
                              ? {
                                  ...c,
                                  grades: c.grades.includes(g)
                                    ? c.grades.filter((x) => x !== g)
                                    : [...c.grades, g],
                                }
                              : c,
                          ),
                        }))
                      }
                      className={[
                        'px-2 py-0.5 rounded text-xs font-medium border transition-colors',
                        sc.grades.includes(g)
                          ? 'bg-[var(--iai-accent)] text-white border-[var(--iai-accent)]'
                          : 'bg-[var(--iai-surface)] text-[var(--iai-text-subtle)] border-[var(--iai-border)]',
                      ].join(' ')}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="text-[var(--iai-text-subtle)] whitespace-nowrap">
                    Hours / week
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    className="input-base w-20"
                    value={sc.hoursPerWeek}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        subjectConfig: s.subjectConfig.map((c, i) =>
                          i === idx ? { ...c, hoursPerWeek: Number(e.target.value) } : c,
                        ),
                      }))
                    }
                  />
                  <span className="text-[var(--iai-text-subtle)]">
                    = {periodsFromHours(sc.hoursPerWeek)} periods
                  </span>
                </div>
              </div>
            ))}
          </div>
          <StepNav
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            nextDisabled={state.subjectConfig.some((sc) => sc.grades.length === 0)}
          />
        </StepCard>
      )}

      {/* Step 5 — Staff */}
      {step === 5 && (
        <StepCard
          title="👩‍🏫 Teaching Staff"
          subtitle="Add the teaching staff at your school."
        >
          <StaffList
            members={state.staff}
            onChange={(staff) => setState((s) => ({ ...s, staff }))}
          />
          {!saved ? (
            <StepNav
              onBack={() => setStep(4)}
              nextLabel="Save Configuration"
              onNext={() => setSaved(true)}
            />
          ) : (
            <div
              role="status"
              className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800"
            >
              ✅ School configuration saved. Teachers can now access the Curriculum
              Engine.
            </div>
          )}
        </StepCard>
      )}
    </div>
  );
}

function StepCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--iai-border)] bg-[var(--iai-surface)] p-6 shadow-sm">
      <h2
        className="text-xl font-bold text-[var(--iai-text)] mb-1"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        {title}
      </h2>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)] mb-1.5">
        {label}
        {hint && (
          <span className="ml-2 normal-case font-normal tracking-normal">— {hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}

function LangChip({
  lang,
  selected,
  onToggle,
}: {
  lang: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        'px-3 py-1 rounded-full text-sm border transition-colors',
        selected
          ? 'bg-[var(--iai-accent)] text-white border-[var(--iai-accent)]'
          : 'bg-[var(--iai-surface)] text-[var(--iai-text)] border-[var(--iai-border)] hover:border-[var(--iai-accent)]',
      ].join(' ')}
    >
      {lang}
    </button>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue →',
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {onBack && (
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-[var(--iai-border)] text-sm font-medium text-[var(--iai-text)] hover:bg-[var(--iai-surface-raised)] transition-colors"
        >
          ← Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="px-5 py-2 rounded-lg bg-[var(--iai-accent)] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function StaffList({
  members,
  onChange,
}: {
  members: StaffMember[];
  onChange: (m: StaffMember[]) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffMember['role']>('Class Teacher');

  function add() {
    if (!name.trim()) return;
    onChange([...members, { name: name.trim(), role }]);
    setName('');
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          className="input-base flex-1 min-w-48"
          placeholder="Educator's full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select
          className="input-base w-44"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffMember['role'])}
        >
          {STAFF_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg bg-[var(--iai-accent)] text-white text-sm font-semibold disabled:opacity-40"
        >
          + Add
        </button>
      </div>
      {members.length > 0 && (
        <ul className="divide-y divide-[var(--iai-border)] border border-[var(--iai-border)] rounded-lg overflow-hidden">
          {members.map((m, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-[var(--iai-text-subtle)]">— {m.role}</span>
              </span>
              <button
                onClick={() => onChange(members.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-700 text-xs"
                aria-label={`Remove ${m.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

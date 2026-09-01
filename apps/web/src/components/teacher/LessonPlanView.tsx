'use client';

import { useState } from 'react';

const FA_TECHNIQUES = [
  'Observation',
  'Questioning',
  'Exit ticket',
  'Whiteboards / show-me',
  'Peer assessment',
  'Self-assessment',
  'Thumbs up/down',
  'Traffic lights',
  'Marking & feedback',
] as const;

const ACTIVITY_KINDS = [
  { kind: 'introduction', label: 'Introduction', emoji: '🔍' },
  { kind: 'development', label: 'Development', emoji: '🛠️' },
  { kind: 'consolidation', label: 'Consolidation', emoji: '✅' },
] as const;

interface Activity {
  kind: 'introduction' | 'development' | 'consolidation';
  description: string;
  durationMinutes: number;
}

interface LessonPlanViewProps {
  grade: string;
  subject: string;
  week: number;
  term: number;
  lessonNumber: number;
  topic?: string;
}

export function LessonPlanView({
  grade,
  subject,
  week,
  term,
  lessonNumber,
  topic: initialTopic = '',
}: LessonPlanViewProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [walt, setWalt] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [selectedFA, setSelectedFA] = useState<Set<string>>(new Set());
  const [activities, setActivities] = useState<Activity[]>([
    { kind: 'introduction', description: '', durationMinutes: 10 },
    { kind: 'development', description: '', durationMinutes: 20 },
    { kind: 'consolidation', description: '', durationMinutes: 10 },
  ]);
  const [resources, setResources] = useState('');

  function toggleFA(technique: string) {
    setSelectedFA((prev) => {
      const next = new Set(prev);
      if (next.has(technique)) next.delete(technique);
      else next.add(technique);
      return next;
    });
  }

  function updateActivity(index: number, field: keyof Activity, value: string | number) {
    setActivities((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMinutes, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)]">
          MOD-01 · Lesson Plan
        </p>
        <h2
          className="text-xl font-bold text-[var(--iai-text)]"
          style={{ fontFamily: 'var(--iai-font-title)' }}
        >
          {subject} · {grade} · Term {term}, Week {week}, L{lessonNumber}
        </h2>
      </div>

      {/* Topic */}
      <FormField label="Topic">
        <input
          className="input-base"
          placeholder="e.g. Nouns — proper and common"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </FormField>

      {/* WALT */}
      <FormField label="WALT (We Are Learning To…)">
        <textarea
          className="input-base min-h-[72px] resize-none"
          placeholder="e.g. identify and use proper nouns correctly in writing"
          value={walt}
          onChange={(e) => setWalt(e.target.value)}
        />
      </FormField>

      {/* Success Criteria */}
      <FormField label="Success Criteria" hint="What learners can do at the end">
        <textarea
          className="input-base min-h-[72px] resize-none"
          placeholder="I can… / Learners will be able to…"
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
        />
      </FormField>

      {/* FA Techniques */}
      <FormField
        label="Formative Assessment Techniques"
        hint="Select all used in this lesson"
      >
        <div className="flex flex-wrap gap-2">
          {FA_TECHNIQUES.map((t) => (
            <button
              key={t}
              aria-pressed={selectedFA.has(t)}
              onClick={() => toggleFA(t)}
              className={[
                'px-3 py-1 rounded-full text-sm border transition-colors',
                selectedFA.has(t)
                  ? 'bg-[var(--iai-accent)] text-white border-[var(--iai-accent)]'
                  : 'bg-[var(--iai-surface)] text-[var(--iai-text)] border-[var(--iai-border)] hover:border-[var(--iai-accent)]',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </FormField>

      {/* Activities */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--iai-text-subtle)]">
            Activities
          </label>
          <span className="text-xs text-[var(--iai-text-subtle)] font-mono">
            {totalMinutes} min total
          </span>
        </div>
        <div className="space-y-3">
          {ACTIVITY_KINDS.map(({ kind, label, emoji }, idx) => {
            const act = activities[idx];
            return (
              <div
                key={kind}
                className="rounded-lg border border-[var(--iai-border)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span>{emoji}</span>
                  <span className="text-sm font-semibold text-[var(--iai-text)]">
                    {label}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <input
                      type="number"
                      min={5}
                      max={60}
                      step={5}
                      className="input-base w-16 text-center text-xs"
                      value={act?.durationMinutes ?? 10}
                      onChange={(e) =>
                        updateActivity(idx, 'durationMinutes', Number(e.target.value))
                      }
                      aria-label={`${label} duration in minutes`}
                    />
                    <span className="text-xs text-[var(--iai-text-subtle)]">min</span>
                  </div>
                </div>
                <textarea
                  className="input-base min-h-[56px] resize-none text-sm w-full"
                  placeholder={
                    kind === 'introduction'
                      ? 'Hook, prior knowledge activation, concept introduction…'
                      : kind === 'development'
                        ? 'Guided practice, explanation, worked examples…'
                        : 'Independent practice, exit task, wrap-up…'
                  }
                  value={act?.description ?? ''}
                  onChange={(e) => updateActivity(idx, 'description', e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Resources */}
      <FormField label="Resources & Materials">
        <textarea
          className="input-base min-h-[56px] resize-none"
          placeholder="DBE Workbook p.12; whiteboard; number cards; etc."
          value={resources}
          onChange={(e) => setResources(e.target.value)}
        />
      </FormField>

      <button className="px-5 py-2 rounded-lg bg-[var(--iai-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
        💾 Save Lesson Plan
      </button>
    </div>
  );
}

function FormField({
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
          <span className="ml-2 normal-case font-normal tracking-normal text-[var(--iai-text-subtle)]">
            — {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

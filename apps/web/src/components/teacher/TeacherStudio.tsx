'use client';

import { useState } from 'react';
import { ModularCard } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';
import type { CurriculumMapData } from '@/lib/atp-curriculum';
import { CurriculumMapView } from './CurriculumMapView';
import { DailyScheduleView } from './DailyScheduleView';
import { LessonPlanView } from './LessonPlanView';

// ── Studio tabs ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'curriculum', label: 'Curriculum Map', emoji: '🗺️' },
  { id: 'schedule', label: 'Daily Schedule', emoji: '📅' },
  { id: 'planner', label: 'Lesson Planner', emoji: '📝' },
  { id: 'ai-studio', label: 'AI Studio', emoji: '🤖' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── AI-studio sub-flow ────────────────────────────────────────────────────────

type Flow = 'idle' | 'lesson' | 'stuck';

const MOCK_LESSON = {
  subject: 'Mathematics',
  grade: 'Grade 8',
  topic: 'Solving linear equations',
  outline: [
    'Recap: what is an equation?',
    'The balance model — both sides must stay equal.',
    'Step-by-step: isolate the variable.',
    'Three worked examples.',
    'Independent practice (10 min).',
    'Exit ticket.',
  ],
};

const MOCK_INTERVENTION = {
  learner: 'Learner (de-identified)',
  pattern: 'Repeated errors on step 2 of multi-step equations.',
  suggestions: [
    'Re-visit the balance model with physical manipulatives.',
    'Use colour-coded equation strips.',
    'Reduce problem complexity to single-step first.',
  ],
};

// ── Honest labelling of the panels that are not connected to data yet ────────

function SampleDataNotice({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      role="note"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] px-3 py-2 text-xs text-[var(--iai-text)]"
    >
      <Badge variant="warning">Sample data</Badge>
      <span>{children}</span>
    </p>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TeacherStudio({
  curriculum,
}: {
  readonly curriculum: CurriculumMapData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('curriculum');

  // AI-studio sub-state
  const [flow, setFlow] = useState<Flow>('idle');
  const [approved, setApproved] = useState<boolean | null>(null);

  return (
    <section aria-labelledby="studio-heading">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            id="studio-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Teacher Studio
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            Curriculum planning &amp; AI-assisted lesson design.
          </p>
        </div>
        <Badge variant="info">MOD-01</Badge>
      </div>

      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Teacher Studio sections"
        className="flex gap-1 flex-wrap mb-6 border-b border-[var(--iai-border)] pb-0"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors -mb-px',
              activeTab === tab.id
                ? 'bg-[var(--iai-bg)] border-[var(--iai-border)] text-[var(--iai-text)]'
                : 'bg-transparent border-transparent text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)]',
            ].join(' ')}
          >
            <span aria-hidden>{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Curriculum Map */}
      <div
        id="panel-curriculum"
        role="tabpanel"
        aria-labelledby="tab-curriculum"
        hidden={activeTab !== 'curriculum'}
      >
        <CurriculumMapView data={curriculum} />
      </div>

      {/* Daily Schedule */}
      <div
        id="panel-schedule"
        role="tabpanel"
        aria-labelledby="tab-schedule"
        hidden={activeTab !== 'schedule'}
      >
        <SampleDataNotice>
          Illustrative timetable only — your school's timetable is not connected yet.
        </SampleDataNotice>
        <DailyScheduleView
          grade="Grade 6"
          week={1}
          term={1}
          schedules={[
            {
              day: 'Monday',
              slots: {
                '1': 'English HL',
                '2': 'Mathematics',
                '3': 'Natural Sciences',
                '4': 'Life Orientation',
                '5': 'Afrikaans FAL',
                '6': 'Social Sciences',
                '7': 'English HL',
                '8': 'Mathematics',
                '9': 'Creative Arts',
                '10': 'EMS',
                '11': 'Technology',
              },
            },
          ]}
        />
      </div>

      {/* Lesson Planner */}
      <div
        id="panel-planner"
        role="tabpanel"
        aria-labelledby="tab-planner"
        hidden={activeTab !== 'planner'}
      >
        <SampleDataNotice>
          Illustrative lesson plan only — it is not read from, or saved to, your school's
          lesson plans.
        </SampleDataNotice>
        <LessonPlanView
          grade="Grade 6"
          subject="English Home Language"
          week={1}
          term={1}
          lessonNumber={1}
          topic="Personal Narrative — My Story"
        />
      </div>

      {/* AI Studio */}
      <div
        id="panel-ai-studio"
        role="tabpanel"
        aria-labelledby="tab-ai-studio"
        hidden={activeTab !== 'ai-studio'}
      >
        <SampleDataNotice>
          Demonstration only — nothing on this tab is generated by a model, and nothing is
          saved when you press Approve or Reject.
        </SampleDataNotice>
        {/* Primary action cards */}
        {flow === 'idle' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <ModularCard
              hue="blue"
              eyebrow="Daily flow"
              title="Give me tomorrow's lesson"
              emoji="📚"
              status="Ready"
              cta="Generate lesson plan"
              onCtaClick={() => setFlow('lesson')}
            >
              <p className="text-sm text-[var(--iai-text-subtle)]">
                AI drafts a lesson plan for your next class. You review, edit, and
                approve.
              </p>
            </ModularCard>

            <ModularCard
              hue="green"
              eyebrow="Learner support"
              title="This learner is stuck"
              emoji="🤝"
              status="Ready"
              cta="See intervention suggestions"
              onCtaClick={() => setFlow('stuck')}
            >
              <p className="text-sm text-[var(--iai-text-subtle)]">
                Surface patterns from anonymised progress data and get differentiation
                ideas.
              </p>
            </ModularCard>
          </div>
        )}

        {/* Lesson plan flow */}
        {flow === 'lesson' && (
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFlow('idle');
                  setApproved(null);
                }}
                className="text-sm text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)]"
                aria-label="Back to studio"
              >
                ← Back
              </button>
            </div>

            {approved === null && (
              <article
                className="rounded-[var(--iai-radius-xl)] border border-[var(--iai-border)] bg-[var(--iai-bg)] shadow-[var(--iai-shadow-md)] overflow-hidden"
                aria-label="AI-drafted lesson plan"
              >
                <div className="bg-gradient-to-br from-[var(--iai-blue)] to-[var(--iai-blue-deep)] p-5 text-white">
                  <p
                    className="text-xs uppercase tracking-widest opacity-80"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    AI DRAFT · Pending your approval
                  </p>
                  <h2
                    className="text-xl font-bold mt-1"
                    style={{ fontFamily: 'var(--iai-font-title)' }}
                  >
                    {MOCK_LESSON.topic}
                  </h2>
                  <p className="text-sm opacity-80 mt-0.5">
                    {MOCK_LESSON.grade} · {MOCK_LESSON.subject}
                  </p>
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-[var(--iai-text)] mb-3">
                    Lesson outline
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5">
                    {MOCK_LESSON.outline.map((step, i) => (
                      <li key={i} className="text-sm text-[var(--iai-text-subtle)]">
                        {step}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-6 flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setApproved(true)}
                      className="px-4 py-2 rounded-[var(--iai-radius-md)] bg-[var(--iai-green)] text-white text-sm font-medium hover:bg-[var(--iai-green-deep)] transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] text-[var(--iai-text)] text-sm font-medium hover:bg-[var(--iai-bg-subtle)] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setApproved(false)}
                      className="px-4 py-2 rounded-[var(--iai-radius-md)] text-[var(--iai-red)] text-sm font-medium hover:bg-[var(--iai-error-bg)] transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            )}

            {approved === true && (
              <div
                role="status"
                aria-live="polite"
                className="p-6 rounded-[var(--iai-radius-xl)] bg-[var(--iai-success-bg)] border border-[var(--iai-success-border)] text-[var(--iai-success-text)]"
              >
                <p className="font-medium">Lesson plan approved and saved.</p>
                <p className="text-sm mt-1">
                  The artefact is in your lesson bank and sent to the HoD queue.
                </p>
              </div>
            )}

            {approved === false && (
              <div
                role="status"
                aria-live="polite"
                className="p-6 rounded-[var(--iai-radius-xl)] bg-[var(--iai-error-bg)] border border-[var(--iai-error-border)] text-[var(--iai-error-text)]"
              >
                <p className="font-medium">Draft rejected.</p>
                <p className="text-sm mt-1">
                  No artefact was published. The feedback is logged for prompt
                  improvement.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Learner stuck flow */}
        {flow === 'stuck' && (
          <div className="max-w-2xl">
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setFlow('idle')}
                className="text-sm text-[var(--iai-text-subtle)] hover:text-[var(--iai-text)]"
                aria-label="Back to studio"
              >
                ← Back
              </button>
            </div>
            <article
              className="rounded-[var(--iai-radius-xl)] border border-[var(--iai-border)] bg-[var(--iai-bg)] shadow-[var(--iai-shadow-md)] overflow-hidden"
              aria-label="Learner intervention suggestions"
            >
              <div className="bg-gradient-to-br from-[var(--iai-green)] to-[var(--iai-green-deep)] p-5 text-white">
                <p
                  className="text-xs uppercase tracking-widest opacity-80"
                  style={{ fontFamily: 'var(--iai-font-mono)' }}
                >
                  INTERVENTION SUGGESTIONS · De-identified
                </p>
                <h2
                  className="text-xl font-bold mt-1"
                  style={{ fontFamily: 'var(--iai-font-title)' }}
                >
                  {MOCK_INTERVENTION.learner}
                </h2>
              </div>
              <div className="p-5">
                <p className="text-sm text-[var(--iai-text-subtle)] mb-4">
                  Pattern identified: {MOCK_INTERVENTION.pattern}
                </p>
                <h3 className="text-sm font-semibold text-[var(--iai-text)] mb-3">
                  Suggestions
                </h3>
                <ul className="space-y-2">
                  {MOCK_INTERVENTION.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm text-[var(--iai-text-subtle)]"
                    >
                      <span aria-hidden className="shrink-0">
                        →
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-[var(--iai-text-subtle)] italic">
                  No learner personal information was used to generate these suggestions.
                </p>
              </div>
            </article>
          </div>
        )}
      </div>
    </section>
  );
}

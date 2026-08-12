'use client';

import { useState } from 'react';
import { ModularCard } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';

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

export function TeacherStudio() {
  const [flow, setFlow] = useState<Flow>('idle');
  const [approved, setApproved] = useState<boolean | null>(null);

  return (
    <section aria-labelledby="studio-heading">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            id="studio-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Teacher Studio
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            AI drafts; you decide.
          </p>
        </div>
        <Badge variant="info">Beta</Badge>
      </div>

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
              AI drafts a lesson plan for your next class. You review, edit, and approve.
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
              <div className="bg-gradient-to-br from-[#1565c0] to-[#0d47a1] p-5 text-white">
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
                    className="px-4 py-2 rounded-[var(--iai-radius-md)] text-[var(--iai-red)] text-sm font-medium hover:bg-[#fee2e2] transition-colors"
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
              className="p-6 rounded-[var(--iai-radius-xl)] bg-[#dcfce7] border border-[#bbf7d0] text-[#166534]"
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
              className="p-6 rounded-[var(--iai-radius-xl)] bg-[#fee2e2] border border-[#fecaca] text-[#991b1b]"
            >
              <p className="font-medium">Draft rejected.</p>
              <p className="text-sm mt-1">
                No artefact was published. The feedback is logged for prompt improvement.
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
            <div className="bg-gradient-to-br from-[#2fae66] to-[#1e7845] p-5 text-white">
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
    </section>
  );
}

import { ModularCard } from '@infinite-ai/design-system';

const ACTIVITIES = [
  { title: 'Solving linear equations', subject: 'Mathematics', status: 'Next up' },
  { title: 'Forces and motion', subject: 'Physical Sciences', status: 'Coming soon' },
];

export function LearnerSpace() {
  return (
    <section aria-labelledby="learner-heading">
      <h1
        id="learner-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-2"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        Learner Space
      </h1>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-6">
        Your learning activities for today.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {ACTIVITIES.map((a) => (
          <ModularCard
            key={a.title}
            hue="amber"
            eyebrow={a.subject}
            title={a.title}
            emoji="✏️"
            status={a.status}
            cta="Start activity"
          >
            <p className="text-sm text-[var(--iai-text-subtle)]">
              Tap to begin when you are ready.
            </p>
          </ModularCard>
        ))}
      </div>
    </section>
  );
}

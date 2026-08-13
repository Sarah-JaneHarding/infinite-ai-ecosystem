import { ModularCard } from '@infinite-ai/design-system';
import {
  buildSampleGraph,
  buildSampleProfile,
  computeLearnerState,
  activityTypeEmoji,
} from '@/lib/learner';
import { GamificationBar } from './GamificationBar';
import { CourseProgress } from './CourseProgress';

const DEMO_LEARNER_ID = 'learner-demo-token';

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  lesson: 'Lesson',
  quiz: 'Quiz',
  assessment: 'Assessment',
  reading: 'Reading',
  video: 'Video',
};

export function LearnerSpace() {
  const graph = buildSampleGraph();
  const profile = buildSampleProfile(DEMO_LEARNER_ID);
  const { availableActivities, progress, gamification, statusCounts, totalActivities } =
    computeLearnerState(graph, profile);

  return (
    <section aria-labelledby="learner-heading">
      <h1
        id="learner-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-2"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        Learner Space
      </h1>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-4">Mathematics · Grade 7</p>

      <GamificationBar gamification={gamification} />

      <CourseProgress
        completed={statusCounts.completed}
        total={totalActivities}
        progressFraction={progress}
      />

      {availableActivities.length === 0 ? (
        <p className="text-[var(--iai-text-subtle)]">
          {statusCounts.completed === totalActivities
            ? 'You have completed all activities in this course.'
            : 'No activities are available right now. Complete the activities in progress to unlock the next ones.'}
        </p>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-[var(--iai-text)] mb-3">Up next</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {availableActivities.map((activity) => (
              <ModularCard
                key={activity.activityId}
                hue="amber"
                eyebrow={ACTIVITY_TYPE_LABEL[activity.type] ?? activity.type}
                title={activity.title}
                emoji={activityTypeEmoji(activity.type)}
                status={`~${activity.estimatedMinutes} min`}
                cta="Start activity"
              >
                <p className="text-sm text-[var(--iai-text-subtle)]">
                  Tap to begin when you are ready.
                </p>
              </ModularCard>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

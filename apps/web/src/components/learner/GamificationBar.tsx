import type { GamificationSnapshotShape } from '@infinite-ai/learner-client';

interface Props {
  readonly gamification: GamificationSnapshotShape;
}

export function GamificationBar({ gamification }: Props) {
  const { xp, level, streakDays, earnedBadgeCount } = gamification;
  return (
    <div
      role="status"
      aria-label="Your achievements"
      className="flex flex-wrap gap-4 text-sm text-[var(--iai-text-subtle)] mb-6"
    >
      <span className="font-semibold text-[var(--iai-text)]">Level {level}</span>
      <span>{xp} XP</span>
      {streakDays > 0 && <span>{streakDays}-day streak</span>}
      {earnedBadgeCount > 0 && (
        <span>
          {earnedBadgeCount} {earnedBadgeCount === 1 ? 'badge' : 'badges'}
        </span>
      )}
    </div>
  );
}

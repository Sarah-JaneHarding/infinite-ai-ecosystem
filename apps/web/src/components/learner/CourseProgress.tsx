interface Props {
  readonly completed: number;
  readonly total: number;
  readonly progressFraction: number;
}

export function CourseProgress({ completed, total, progressFraction }: Props) {
  const pct = Math.round(progressFraction * 100);
  return (
    <div className="mb-6 max-w-md">
      <div className="flex justify-between text-xs text-[var(--iai-text-subtle)] mb-1">
        <span>Course progress</span>
        <span>{pct}%</span>
      </div>
      <progress
        value={progressFraction}
        max={1}
        aria-label={`${pct}% of course complete — ${completed} of ${total} activities done`}
        className="w-full h-2 rounded-full"
        style={{ accentColor: 'var(--iai-accent)' }}
      />
      <p className="text-xs text-[var(--iai-text-subtle)] mt-1">
        {completed} of {total} {total === 1 ? 'activity' : 'activities'} complete
      </p>
    </div>
  );
}

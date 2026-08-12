import { Card } from '@infinite-ai/design-system';

export function GuardianPortal() {
  return (
    <section aria-labelledby="guardian-heading">
      <h1
        id="guardian-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-2"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        Parent Portal
      </h1>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-6">
        Simplified view — only information about your child is shown.
      </p>

      <div className="grid grid-cols-1 gap-4 max-w-lg">
        <Card>
          <h2 className="text-base font-semibold text-[var(--iai-text)] mb-3">
            School notices
          </h2>
          <ul className="space-y-2" role="list">
            <li className="text-sm text-[var(--iai-text-subtle)]">
              Term 3 results available from 25 August.
            </li>
            <li className="text-sm text-[var(--iai-text-subtle)]">
              Parent evening: 3 September 18:00.
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-[var(--iai-text)] mb-3">
            Progress summary
          </h2>
          <p className="text-sm text-[var(--iai-text-subtle)]">
            Progress information will be shared by the school once Term 3 assessments are
            completed.
          </p>
        </Card>
      </div>
    </section>
  );
}

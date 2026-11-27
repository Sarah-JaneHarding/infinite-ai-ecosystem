import { Badge, Card } from '@infinite-ai/design-system';

// This page used to show two school notices ("Term 3 results available from 25 August",
// "Parent evening: 3 September 18:00"), a promise that progress would be shared "once Term 3
// assessments are completed", and the line "only information about your child is shown".
// None of it came from the school, and the last claim described a restriction this page never
// exercised. A parent reads a date on a school page as the school's date, so it is worse than
// an empty page. There is nothing real to show, and nothing here may pretend otherwise:
//  - the page reads no school record: no notice, no result, no progress, no learner;
//  - guardian access to a child's information needs its own decision (consent, how a guardian
//    is linked to a learner, what they may see), recorded in docs/OPEN_QUESTIONS.md (OQ-056).
// Until that is decided and built the page says so, and tells a parent to ask the school.

export function GuardianPortal() {
  return (
    <section aria-labelledby="guardian-heading">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1
            id="guardian-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Parent Portal
          </h1>
        </div>
        <Badge variant="info">Not in use yet</Badge>
      </div>

      <div className="max-w-lg">
        <Card>
          <p role="status" className="text-sm font-semibold text-[var(--iai-text)] mb-2">
            Nothing to show yet
          </p>
          <p className="text-sm text-[var(--iai-text-subtle)] mb-2">
            This portal does not show any school notices, results or progress yet, and
            nothing on this page comes from your child&rsquo;s school.
          </p>
          <p className="text-sm text-[var(--iai-text-subtle)]">
            For dates, results and appointments, please ask the school directly.
          </p>
        </Card>
      </div>
    </section>
  );
}

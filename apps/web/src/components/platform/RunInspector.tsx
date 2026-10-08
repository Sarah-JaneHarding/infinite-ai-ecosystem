import { Badge, Card } from '@infinite-ai/design-system';

// This page used to list three sample runs under "Live view of agent runs across all
// tenants". There is no such view to show, and nothing here may pretend otherwise:
//  - run records are tenant-scoped, and the access policy gives neither platform role any
//    right to read them (`packages/policy` rbac: platform_support and platform_admin hold
//    tenant settings, audit events and class groups, never runs);
//  - the one sanctioned way platform staff touch a school's data is a support session that
//    the school's administrator has approved, with a stated reason and a time limit
//    (`packages/policy` impersonation), and that session flow is not built into the app yet.
// So the page says that, and shows no run, no tenant and no status.

export function RunInspector() {
  return (
    <section aria-labelledby="runs-heading">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1
            id="runs-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Run Inspector
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            Platform access only.
          </p>
        </div>
        <Badge variant="error">Platform access</Badge>
      </div>

      <Card>
        <p role="status" className="text-sm font-semibold text-[var(--iai-text)] mb-2">
          Not available yet
        </p>
        <p className="text-sm text-[var(--iai-text-subtle)] mb-2">
          Agent runs belong to the school that produced them, and there is no view of runs
          across schools.
        </p>
        <p className="text-sm text-[var(--iai-text-subtle)]">
          Platform staff can see a school&rsquo;s records only through a support session
          that the school&rsquo;s administrator has approved, with a stated reason and a
          time limit. That support session is not available in the app yet, so there is
          nothing to show here.
        </p>
      </Card>
    </section>
  );
}

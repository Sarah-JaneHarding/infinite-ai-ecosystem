import { Card } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';
import { StatusPill } from '@infinite-ai/design-system';

const RUNS = [
  {
    id: 'run-a1b2',
    agent: 'CE-01',
    tenant: 'tenant-001',
    status: 'approved' as const,
    durationMs: 1240,
    ts: '2026-08-12T09:14:22Z',
  },
  {
    id: 'run-c3d4',
    agent: 'TB-03',
    tenant: 'tenant-002',
    status: 'pending' as const,
    durationMs: 2100,
    ts: '2026-08-12T09:11:05Z',
  },
  {
    id: 'run-e5f6',
    agent: 'PD-02',
    tenant: 'tenant-001',
    status: 'rejected' as const,
    durationMs: 980,
    ts: '2026-08-12T09:09:41Z',
  },
];

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
            Live view of agent runs across all tenants. Platform access only.
          </p>
        </div>
        <Badge variant="error">Platform access</Badge>
      </div>

      <div className="overflow-x-auto">
        <Card>
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-[var(--iai-border)]">
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Run ID
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Agent
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Tenant
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="text-right py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Duration
                </th>
                <th
                  scope="col"
                  className="text-left py-2 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {RUNS.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--iai-border)] last:border-0"
                >
                  <td
                    className="py-2.5 pr-4 font-medium text-[var(--iai-text)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.id}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.agent}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.tenant}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusPill status={r.status} />
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.durationMs}ms
                  </td>
                  <td
                    className="py-2.5 text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.ts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}

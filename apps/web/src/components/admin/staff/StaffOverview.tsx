import type { StaffOverview as Overview } from '@infinite-ai/db';

import { ROLE_LABEL } from '@/lib/roles';
import { readRole } from '@/lib/session-role';

const TH =
  'text-left text-xs font-semibold uppercase tracking-wide px-3 py-2.5 border-b border-[var(--iai-border)] whitespace-nowrap';
const TD = 'px-3 py-2.5 border-b border-[var(--iai-border)] text-sm align-top';

/** A role's display name; a stored role this build does not know is shown as stored, never hidden. */
function label(role: string): string {
  const known = readRole(role);
  return known === null ? role : ROLE_LABEL[known];
}

const STATUS_LABEL = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  OFFBOARDED: 'Offboarded',
};
const CONFIRMATION_LABEL = {
  NOT_REQUIRED: '',
  AWAITING: 'Waiting for a second administrator',
  CONFIRMED: 'Confirmed',
  WAIVED_SOLE_ADMIN: 'Sole administrator',
};

const date = (d: Date): string => d.toISOString().slice(0, 10);

export interface StaffOverviewProps {
  readonly overview: Overview;
}

/** Read-only for now (OQ-033 step 5, slice a): who has an account, what they hold, what is waiting. */
export function StaffOverview({ overview }: StaffOverviewProps) {
  const names = new Map(overview.accounts.map((a) => [a.id, a.displayName]));
  const nameOf = (id: string): string => names.get(id) ?? 'Unknown account';
  return (
    <div className="flex flex-col gap-10">
      {overview.truncated && (
        <p role="status" className="text-sm text-[var(--iai-warning-text)]">
          This list is cut short. Not everyone is shown.
        </p>
      )}

      <section aria-labelledby="staff-accounts">
        <h2 id="staff-accounts" className="text-lg font-semibold mb-3">
          Accounts ({overview.accounts.length})
        </h2>
        {overview.accounts.length === 0 ? (
          <p role="status" className="text-sm text-[var(--iai-text-subtle)]">
            No one has signed in yet. Invite your staff to get started.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Status</th>
                <th className={TH}>Roles</th>
              </tr>
            </thead>
            <tbody>
              {overview.accounts.map((a) => (
                <tr key={a.id}>
                  <td className={TD}>{a.displayName}</td>
                  <td className={TD}>{a.email}</td>
                  <td className={TD}>{STATUS_LABEL[a.status]}</td>
                  <td className={TD}>
                    {a.roles.length === 0 ? (
                      <span className="text-[var(--iai-text-subtle)]">None</span>
                    ) : (
                      <ul>
                        {a.roles.map((r) => (
                          <li key={r.role}>
                            {label(r.role)}
                            {r.expired ? ' (lapsed)' : ''}
                            {!r.expired && r.expiresAt !== null
                              ? ` (until ${date(r.expiresAt)})`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="staff-invitations">
        <h2 id="staff-invitations" className="text-lg font-semibold mb-3">
          Pending invitations ({overview.invitations.length})
        </h2>
        {overview.invitations.length === 0 ? (
          <p role="status" className="text-sm text-[var(--iai-text-subtle)]">
            No invitations are waiting.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Email</th>
                <th className={TH}>Roles</th>
                <th className={TH}>Expires</th>
                <th className={TH}>Confirmation</th>
              </tr>
            </thead>
            <tbody>
              {overview.invitations.map((i) => (
                <tr key={i.id}>
                  <td className={TD}>{i.email}</td>
                  <td className={TD}>{i.roles.map(label).join(', ')}</td>
                  <td className={TD}>
                    {date(i.expiresAt)}
                    {i.expired ? ' (expired)' : ''}
                  </td>
                  <td className={TD}>{CONFIRMATION_LABEL[i.confirmation]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="staff-requests">
        <h2 id="staff-requests" className="text-lg font-semibold mb-3">
          Role requests waiting for a second administrator (
          {overview.grantRequests.length})
        </h2>
        {overview.grantRequests.length === 0 ? (
          <p role="status" className="text-sm text-[var(--iai-text-subtle)]">
            No role requests are waiting.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>For</th>
                <th className={TH}>Roles</th>
                <th className={TH}>Proposed by</th>
                <th className={TH}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {overview.grantRequests.map((g) => (
                <tr key={g.id}>
                  <td className={TD}>{nameOf(g.targetAccountId)}</td>
                  <td className={TD}>{g.roles.map(label).join(', ')}</td>
                  <td className={TD}>{nameOf(g.requestedBy)}</td>
                  <td className={TD}>
                    {date(g.expiresAt)}
                    {g.expired ? ' (expired)' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

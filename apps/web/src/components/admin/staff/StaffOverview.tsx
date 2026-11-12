import type { StaffOverview as Overview } from '@infinite-ai/db';
import { isSchoolStaffRole } from '@infinite-ai/policy';

import { ROLE_LABEL } from '@/lib/roles';
import { readRole } from '@/lib/session-role';

import { GrantRoleForm } from './GrantRoleForm';
import { StaffActionButton } from './StaffActionButton';

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
  /** The viewer's own account. No status action is offered on it (the server refuses it anyway). */
  readonly selfId?: string;
}

/** Read-only for now (OQ-033 step 5, slice a): who has an account, what they hold, what is waiting. */
export function StaffOverview({ overview, selfId }: StaffOverviewProps) {
  const names = new Map(overview.accounts.map((a) => [a.id, a.displayName]));
  const nameOf = (id: string): string => names.get(id) ?? 'Unknown account';
  const schoolNames = new Map(overview.schools.map((s) => [s.id, s.name]));
  // A scope is only worth naming when there is more than one school to tell apart.
  const scopeOf = (schoolId: string | null): string =>
    schoolId !== null && overview.schools.length > 1
      ? ` — ${schoolNames.get(schoolId) ?? 'unknown school'}`
      : '';
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
                <th className={TH}>
                  <span className="sr-only">Give a role</span>
                </th>
                <th className={TH}>
                  <span className="sr-only">Account actions</span>
                </th>
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
                          <li key={r.role} className="flex gap-2 items-baseline">
                            <span>
                              {label(r.role)}
                              {scopeOf(r.schoolId)}
                              {r.expired ? ' (lapsed)' : ''}
                              {!r.expired && r.expiresAt !== null
                                ? ` (until ${date(r.expiresAt)})`
                                : ''}
                            </span>
                            {!r.expired &&
                              a.status === 'ACTIVE' &&
                              isSchoolStaffRole(r.role) && (
                                <StaffActionButton
                                  label="Remove"
                                  busyLabel="Removing…"
                                  tone="danger"
                                  url={`/api/admin/staff/accounts/${a.id}/roles/revoke`}
                                  body={{ role: r.role }}
                                  confirmText={`Remove the ${label(r.role)} role from ${a.displayName}?`}
                                />
                              )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={TD}>
                    {a.status === 'ACTIVE' ? (
                      <GrantRoleForm accountId={a.id} schools={overview.schools} />
                    ) : null}
                  </td>
                  <td className={TD}>
                    {a.id !== selfId && a.status !== 'OFFBOARDED' && (
                      <span className="flex flex-col gap-1">
                        {a.status === 'ACTIVE' && (
                          <StaffActionButton
                            label="Suspend"
                            busyLabel="Suspending…"
                            tone="danger"
                            url={`/api/admin/staff/accounts/${a.id}/status`}
                            body={{ status: 'SUSPENDED' }}
                            confirmText={`Suspend ${a.displayName}? They will not be able to sign in or decide approvals. This cannot be undone from here.`}
                          />
                        )}
                        <StaffActionButton
                          label="Offboard"
                          busyLabel="Offboarding…"
                          tone="danger"
                          url={`/api/admin/staff/accounts/${a.id}/status`}
                          body={{ status: 'OFFBOARDED' }}
                          confirmText={`Offboard ${a.displayName}? This ends all their roles and cannot be undone.`}
                        />
                      </span>
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
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.invitations.map((i) => (
                <tr key={i.id}>
                  <td className={TD}>{i.email}</td>
                  <td className={TD}>
                    {i.roles.map(label).join(', ')}
                    {scopeOf(i.schoolId)}
                  </td>
                  <td className={TD}>
                    {date(i.expiresAt)}
                    {i.expired ? ' (expired)' : ''}
                  </td>
                  <td className={TD}>{CONFIRMATION_LABEL[i.confirmation]}</td>
                  <td className={TD}>
                    <span className="flex flex-col gap-1">
                      {i.confirmation === 'AWAITING' && !i.expired && (
                        <StaffActionButton
                          label="Confirm"
                          busyLabel="Confirming…"
                          url={`/api/admin/staff/invitations/${i.id}/confirm`}
                          confirmText="Confirm this invitation? The person will be able to sign in with these roles."
                        />
                      )}
                      <StaffActionButton
                        label="Revoke"
                        busyLabel="Revoking…"
                        tone="danger"
                        url={`/api/admin/staff/invitations/${i.id}/revoke`}
                      />
                    </span>
                  </td>
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
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
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
                  <td className={TD}>
                    <span className="flex flex-col gap-1">
                      {!g.expired && (
                        <StaffActionButton
                          label="Confirm"
                          busyLabel="Confirming…"
                          url={`/api/admin/staff/role-requests/${g.id}/confirm`}
                          confirmText={`Give ${g.roles.map(label).join(', ')} to ${nameOf(g.targetAccountId)}?`}
                        />
                      )}
                      {!g.expired && (
                        <StaffActionButton
                          label="Decline"
                          busyLabel="Declining…"
                          tone="danger"
                          url={`/api/admin/staff/role-requests/${g.id}/decline`}
                        />
                      )}
                      <StaffActionButton
                        label="Cancel"
                        busyLabel="Cancelling…"
                        tone="danger"
                        url={`/api/admin/staff/role-requests/${g.id}/cancel`}
                      />
                    </span>
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

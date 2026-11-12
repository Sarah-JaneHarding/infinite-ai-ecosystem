import type { Role } from '@infinite-ai/policy';

import { ROLE_LABEL } from '@/lib/roles';

export interface RoleChoiceProps {
  readonly roles: readonly Role[];
  /** Disables the buttons while a choice is being saved. */
  readonly busy: boolean;
  readonly onChoose: (role: Role) => void;
}

/** One button per role the person may act as. Presentational: no hooks, so it renders in a unit test. */
export function RoleChoice({ roles, busy, onChoose }: RoleChoiceProps) {
  return (
    <div className="rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-md)] p-8">
      <h1 className="text-lg font-semibold text-[var(--iai-text)] mb-2">
        Who are you acting as?
      </h1>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-6">
        You hold more than one role at your school. Choose the one for this session. To
        act as another role, sign in again.
      </p>
      <ul className="flex flex-col gap-3">
        {roles.map((role) => (
          <li key={role}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose(role)}
              className="w-full py-2.5 px-4 rounded-[var(--iai-radius-md)] bg-[var(--iai-primary)] text-white text-sm font-medium hover:bg-[var(--iai-primary-deep)] disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iai-primary)] focus-visible:ring-offset-2"
            >
              {ROLE_LABEL[role]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

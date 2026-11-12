'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { useState } from 'react';

import type { Role } from '@infinite-ai/policy';

import { RoleChoice } from './RoleChoice';

function Chooser({ roles }: { readonly roles: readonly Role[] }) {
  const { update } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = (role: Role): void => {
    setBusy(true);
    setFailed(false);
    // The server decides: it accepts the role only if it is in the token's own eligible list and no
    // role is active yet (auth.ts). Reloading from `/` then lands on that role's home.
    update({ role })
      .then(() => window.location.assign('/'))
      .catch(() => {
        setFailed(true);
        setBusy(false);
      });
  };

  return (
    <>
      {failed && (
        <p role="alert" className="mb-4 text-sm text-[var(--iai-error-text)]">
          That choice could not be saved. Please try again.
        </p>
      )}
      <RoleChoice roles={roles} busy={busy} onChoose={choose} />
    </>
  );
}

export function RoleChooser({ roles }: { readonly roles: readonly Role[] }) {
  return (
    <SessionProvider>
      <Chooser roles={roles} />
    </SessionProvider>
  );
}

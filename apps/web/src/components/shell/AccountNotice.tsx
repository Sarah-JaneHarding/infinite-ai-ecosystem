export interface AccountNoticeProps {
  readonly message: string | null;
}

/** Why the signed-in person has no account yet, and what to do. Nothing when there is nothing to say. */
export function AccountNotice({ message }: AccountNoticeProps) {
  if (message === null) return null;
  return (
    <div
      role="status"
      className="w-full px-4 py-2 bg-[var(--iai-amber)] text-[var(--iai-warning-text)] text-sm text-center"
    >
      {message}
    </div>
  );
}

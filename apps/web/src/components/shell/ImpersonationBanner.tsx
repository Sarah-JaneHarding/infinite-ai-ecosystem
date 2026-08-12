export interface ImpersonationBannerProps {
  readonly impersonating: string | null;
}

export function ImpersonationBanner({ impersonating }: ImpersonationBannerProps) {
  if (!impersonating) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full px-4 py-1.5 bg-[var(--iai-amber)] text-[#854d0e] text-xs font-medium text-center"
    >
      Viewing as <strong>{impersonating}</strong> — platform admin session
    </div>
  );
}

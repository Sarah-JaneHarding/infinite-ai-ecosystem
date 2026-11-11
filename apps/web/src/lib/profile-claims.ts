// What the sign-in needs from the identity provider's profile, read defensively. A claim that is
// missing or the wrong type is "not asserted", never a guess: an unverified address in particular
// must stay unverified.

export interface ProfileIdentity {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
}

function claim(profile: unknown, key: string): unknown {
  return typeof profile === 'object' && profile !== null
    ? (profile as Record<string, unknown>)[key]
    : undefined;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** `email_verified` counts only as the boolean `true` — not the string "true", not 1. */
export function identityFromProfile(profile: unknown): ProfileIdentity {
  return {
    email: text(claim(profile, 'email')),
    emailVerified: claim(profile, 'email_verified') === true,
    displayName:
      text(claim(profile, 'name')) || text(claim(profile, 'preferred_username')),
  };
}

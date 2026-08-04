// Credential pooling — Stage 04 step 3.
//
// "Multiple accounts or keys per provider, round-robin with health tracking, automatic
// cool-down on rate limits, and no credential in logs or traces."
//
// A pool holds keys for one provider. Selecting a credential never reveals which key it
// picked in a form a log line could capture — callers get an opaque `CredentialHandle`,
// and the raw value is read exactly once, at the point an adapter attaches it to a
// request. `secret()` wraps every key so `packages/telemetry`'s logger redacts it even if
// a caller does something careless with the handle.

import { secret, type Secret } from '@infinite-ai/telemetry';

export interface CredentialHandle {
  readonly id: string;
  readonly reveal: () => string;
}

interface PoolEntry {
  readonly id: string;
  readonly key: Secret;
  /** Timestamp (ms) before which this credential is not offered. */
  cooldownUntil: number;
}

export interface CredentialPoolOptions {
  readonly cooldownMs?: number;
  readonly now?: () => number;
}

export class NoCredentialAvailableError extends Error {
  public override readonly name = 'NoCredentialAvailableError';
  constructor(provider: string) {
    super(`No credential for provider "${provider}" is out of cooldown.`);
  }
}

/**
 * Round-robins across a provider's keys, skipping any still cooling down from a rate
 * limit. A pool with one key degrades to "always that key, respecting its cooldown" —
 * correct, just with no failover, which is an honest reflection of a single-key tenant.
 */
export class CredentialPool {
  private readonly entries: PoolEntry[];
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private cursor = 0;

  constructor(
    public readonly provider: string,
    keys: readonly string[],
    options: CredentialPoolOptions = {},
  ) {
    if (keys.length === 0) {
      throw new Error(`Credential pool for "${provider}" needs at least one key.`);
    }
    this.entries = keys.map((key, index) => ({
      id: `${provider}-${index}`,
      key: secret(key),
      cooldownUntil: 0,
    }));
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.now = options.now ?? (() => Date.now());
  }

  /** All secret values, so a logger can be told to redact them at boot. */
  secrets(): readonly Secret[] {
    return this.entries.map((entry) => entry.key);
  }

  /** Picks the next credential not currently cooling down, advancing the round-robin. */
  take(): CredentialHandle {
    const nowMs = this.now();
    for (let step = 0; step < this.entries.length; step += 1) {
      const index = (this.cursor + step) % this.entries.length;
      const entry = this.entries[index]!;
      if (entry.cooldownUntil <= nowMs) {
        this.cursor = (index + 1) % this.entries.length;
        return { id: entry.id, reveal: entry.key.reveal };
      }
    }
    throw new NoCredentialAvailableError(this.provider);
  }

  /** Called when a credential comes back rate-limited, so `take()` skips it for a while. */
  reportRateLimited(handle: CredentialHandle): void {
    const entry = this.entries.find((candidate) => candidate.id === handle.id);
    if (entry !== undefined) entry.cooldownUntil = this.now() + this.cooldownMs;
  }

  /** How many of this pool's keys are currently available, for health reporting. */
  availableCount(): number {
    const nowMs = this.now();
    return this.entries.filter((entry) => entry.cooldownUntil <= nowMs).length;
  }
}

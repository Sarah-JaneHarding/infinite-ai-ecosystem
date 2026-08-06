// The per-provider circuit breaker — Stage 06 step 8.
//
// "A circuit breaker per provider." Closed: calls pass through and count failures.
// Open: calls are refused immediately, without ever reaching the provider, once
// `failureThreshold` consecutive retryable failures have occurred — for `openDurationMs`.
// Half-open: once that cooldown has elapsed, exactly one trial call is allowed through;
// success closes the breaker and resets its count, failure reopens it for a fresh
// `openDurationMs`.
//
// This complements, rather than replaces, `credentials/pool.ts`'s own per-credential
// cooldown: that is "this one credential just got rate-limited," scoped to a single key
// with its own fixed cooldown; this is "this provider, in aggregate, looks unhealthy right
// now," scoped to every caller routing through it, opened only after a run of consecutive
// failures rather than a single one.
//
// Only failures `router.ts`'s own fallback chain already treats as provider-health signals
// count against a provider here — `AdapterError.retryable` ('rate_limited' | 'unavailable'
// | 'timeout'). An `invalid_request` means our own request was malformed, not that the
// provider is unhealthy; `unauthorized` is a credential problem, not a provider one. Both
// are the router's job to handle, never this breaker's to open on.

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Consecutive failures before the breaker opens. */
  readonly failureThreshold: number;
  /** How long the breaker stays open before allowing one half-open trial. */
  readonly openDurationMs: number;
  readonly now?: () => Date;
}

interface ProviderState {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: Date | null;
  /** Only one half-open trial may be in flight at a time — a second caller arriving
   * before the first trial resolves is refused, not given a second trial. */
  halfOpenTrialInFlight: boolean;
}

/**
 * Tracks breaker state per provider, in memory. Single-process, the same documented
 * limitation `BudgetTracker` and `CredentialPool` already carry — a multi-instance gateway
 * sharing breaker state needs a shared store, a stated follow-up, not a silent gap.
 */
export class CircuitBreaker {
  private readonly providers = new Map<string, ProviderState>();
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly now: () => Date;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.openDurationMs = options.openDurationMs;
    this.now = options.now ?? (() => new Date());
  }

  private stateFor(provider: string): ProviderState {
    let state = this.providers.get(provider);
    if (state === undefined) {
      state = {
        state: 'closed',
        consecutiveFailures: 0,
        openedAt: null,
        halfOpenTrialInFlight: false,
      };
      this.providers.set(provider, state);
    }
    return state;
  }

  /**
   * Whether a call to `provider` should even be attempted right now. The open-to-half-open
   * transition happens here, the moment a caller actually asks and the cooldown has
   * elapsed — driven by real traffic rather than a timer this class would otherwise have
   * to run on its own.
   */
  allowsRequest(provider: string): boolean {
    const state = this.stateFor(provider);

    if (state.state === 'closed') return true;

    if (state.state === 'open') {
      const elapsed = this.now().getTime() - state.openedAt!.getTime();
      if (elapsed < this.openDurationMs) return false;
      state.state = 'half_open';
      state.halfOpenTrialInFlight = false;
    }

    // half_open: exactly one trial in flight at a time.
    if (state.halfOpenTrialInFlight) return false;
    state.halfOpenTrialInFlight = true;
    return true;
  }

  /** Closes the breaker and resets its failure count — a successful call, whether it was
   * an ordinary closed-state call or the one half-open trial. */
  recordSuccess(provider: string): void {
    const state = this.stateFor(provider);
    state.state = 'closed';
    state.consecutiveFailures = 0;
    state.openedAt = null;
    state.halfOpenTrialInFlight = false;
  }

  /** Records a provider-health failure. A failed half-open trial reopens immediately for a
   * fresh cooldown, without waiting for `failureThreshold` again — a single trial failure
   * is conclusive, the same way one relapse ends a probation period rather than restarting
   * a count. */
  recordFailure(provider: string): void {
    const state = this.stateFor(provider);

    if (state.state === 'half_open') {
      state.state = 'open';
      state.openedAt = this.now();
      state.halfOpenTrialInFlight = false;
      state.consecutiveFailures += 1;
      return;
    }

    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= this.failureThreshold) {
      state.state = 'open';
      state.openedAt = this.now();
    }
  }

  stateOf(provider: string): CircuitState {
    return this.stateFor(provider).state;
  }
}

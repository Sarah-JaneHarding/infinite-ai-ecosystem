// L4 Working memory — Stage 05 step 1.
//
// Per-run scratchpad with a TTL, not durable Brain memory. Nothing here is append-only,
// nothing here is provenanced, and nothing here survives past its TTL or an explicit
// eviction — that is the entire point of a working tier, as distinct from L0-L3.
//
// The manual names Redis for this tier explicitly, unlike the prompt cache in Stage 04
// (which the manual leaves unspecified and which shipped in-memory as a documented
// deviation). No dependency is added here for it regardless: `WorkingMemoryStore` is the
// whole contract, `InMemoryWorkingMemoryStore` is what every test in this package runs
// against, and a Redis-backed implementation is real integration work for whichever
// stage first has a concrete run to scope a scratchpad to — Stage 06's orchestrator. Until
// then there is no caller to wire it to, and building the Redis client now would be
// exactly the kind of dependency added before anything needs it that rule 9 exists to
// stop.
//
// `promote()` deliberately does not write anything to L2. It reads back everything a run
// stored and hands back a summary — turning that summary into a committed `BrainEpisode`
// is the write path's job (step 2), which is what actually stamps provenance and puts a
// row through ratification/contradiction-checking before anything durable is written.

export interface WorkingMemoryStore {
  /** Stores `value` under `key`, scoped to `runId`, expiring after `ttlSeconds`. */
  readonly remember: (
    runId: string,
    key: string,
    value: unknown,
    ttlSeconds: number,
  ) => Promise<void>;
  /** Reads one entry. `undefined` if it was never stored, has expired, or was evicted. */
  readonly recall: (runId: string, key: string) => Promise<unknown | undefined>;
  /** Reads every live entry for a run, keyed by the key it was stored under. */
  readonly recallAll: (runId: string) => Promise<Record<string, unknown>>;
  /** Discards every entry for a run immediately, regardless of TTL — step 8's per-run
   *  working-memory eviction. */
  readonly evict: (runId: string) => Promise<void>;
}

interface Entry {
  readonly value: unknown;
  readonly expiresAt: number;
}

/**
 * An in-process `WorkingMemoryStore`. What this package's own tests run against, and a
 * usable default for local development with a single gateway process — the same shape of
 * stand-in Stage 04's `GatewayCache` and `BudgetTracker` are for their own Redis-backed
 * production stores.
 */
export class InMemoryWorkingMemoryStore implements WorkingMemoryStore {
  private readonly runs = new Map<string, Map<string, Entry>>();

  constructor(private readonly now: () => number = Date.now) {}

  async remember(
    runId: string,
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    let run = this.runs.get(runId);
    if (run === undefined) {
      run = new Map();
      this.runs.set(runId, run);
    }
    run.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async recall(runId: string, key: string): Promise<unknown | undefined> {
    const entry = this.runs.get(runId)?.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.runs.get(runId)?.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async recallAll(runId: string): Promise<Record<string, unknown>> {
    const run = this.runs.get(runId);
    if (run === undefined) return {};
    const now = this.now();
    const live: Record<string, unknown> = {};
    for (const [key, entry] of run) {
      if (entry.expiresAt > now) live[key] = entry.value;
      else run.delete(key);
    }
    return live;
  }

  async evict(runId: string): Promise<void> {
    this.runs.delete(runId);
  }
}

export interface WorkingMemorySummary {
  readonly runId: string;
  readonly entries: Record<string, unknown>;
  readonly promotedAt: Date;
}

/**
 * Reads back everything a run has stored, as a summary ready to be handed to the write
 * path. Does not evict — a promotion is a snapshot, not a destructive read, and the run
 * may still be in flight. Call `evict()` separately once the run itself has finished.
 */
export async function promote(
  store: WorkingMemoryStore,
  runId: string,
): Promise<WorkingMemorySummary> {
  const entries = await store.recallAll(runId);
  return { runId, entries, promotedAt: new Date() };
}

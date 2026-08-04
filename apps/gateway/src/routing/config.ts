// Model routing configuration — Stage 04 step 4.
//
// "A named logical model maps to an ordered chain of concrete models... Routing is
// configuration, not code." So this file is a schema and a loader, not a switch statement.
// Changing which provider serves `plan.author`, or adding a fallback, is a change to a
// JSON file reviewed like any other config change — never a code change to the router.

import { LogicalModel } from '@infinite-ai/contracts';
import { z } from 'zod';

/**
 * One link in a logical model's fallback chain: a provider family (a key into the
 * adapter registry the gateway was booted with) and the concrete model name that
 * provider's API expects.
 */
export const RoutingLink = z.object({
  provider: z.string().min(1),
  concreteModel: z.string().min(1),
});
export type RoutingLink = z.infer<typeof RoutingLink>;

const RoutingConfigShape = z.record(z.string(), z.array(RoutingLink).min(1));

export class InvalidRoutingConfigError extends Error {
  public override readonly name = 'InvalidRoutingConfigError';
  constructor(issues: readonly string[]) {
    super(
      `Invalid model routing configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`,
    );
  }
}

/**
 * Maps every logical model this deployment knows about to its fallback chain.
 *
 * Parsed rather than typed as a plain object so a malformed routing file — an empty
 * chain, a logical model name that does not match the `domain.action` convention — fails
 * at boot with a specific message, the same discipline `packages/config`'s env loader
 * applies (Stage 00 step 4): the application does not start on bad configuration, it does
 * not fall back to guessing what was meant.
 */
export function parseRoutingConfig(
  candidate: unknown,
): Record<string, readonly RoutingLink[]> {
  const shapeResult = RoutingConfigShape.safeParse(candidate);
  if (!shapeResult.success) {
    throw new InvalidRoutingConfigError(
      shapeResult.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    );
  }

  const issues: string[] = [];
  for (const key of Object.keys(shapeResult.data)) {
    if (!LogicalModel.safeParse(key).success) {
      issues.push(
        `"${key}" is not a valid logical model name (expected "domain.action")`,
      );
    }
  }
  if (issues.length > 0) throw new InvalidRoutingConfigError(issues);

  return shapeResult.data;
}

/**
 * The default when no `ROUTING_CONFIG_PATH` is set: nothing. Naming even one logical
 * model here would mean guessing which provider a fresh deployment has actually
 * configured — get that guess wrong (as an earlier draft of this file did, hard-coding a
 * `local` provider with no adapter to back it) and the gateway refuses to boot at all,
 * over a model nobody asked for yet. An empty routing table is a safe, honest starting
 * point: `createRouter`'s boot validation has nothing to check, and every logical model a
 * caller actually requests fails with `UnknownLogicalModelError` until a real routing file
 * names it — the same "ships nothing until someone decides" shape as the retention
 * schedule template and the zero-cost default in `index.ts`.
 */
export const DEFAULT_ROUTING_CONFIG: Record<string, readonly RoutingLink[]> = {};

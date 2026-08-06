// The Tool registry — Stage 06 step 7.
//
// "Tools are declared with a Zod schema, a purpose, an idempotency policy and a
// side-effect classification (read, write, external, irreversible). irreversible tools
// always require a human gate." The declaration shape itself — `ToolDeclaration` — was
// already built in step 1, as part of an agent's own contract (`AgentContract.tools`).
// This step adds the registry: a system-wide place every tool is registered once, keyed
// by name, with the same "boot failure, not a warning" discipline `AgentRegistry` (step 2)
// already established for agents.
//
// The enforcement half of step 7's own text — an `irreversible` tool a pipeline can reach
// without a preceding `human_gate` — lives in `@infinite-ai/orchestrator`'s
// `validatePipelineGating` (`dag.ts`), not here. That function takes a plain
// `(toolName: string) => boolean` callback rather than this class, deliberately: `agents`
// and `orchestrator` are peers in the same layer (Part 1's own architecture — both are L6
// agent runtime), and neither needs a dependency on the other just to answer "is this tool
// irreversible." `ToolRegistry.isIrreversible`, below, is what a caller who already has
// both packages in scope hands to that function.

import { ToolDeclaration } from './contract.js';

export class ToolRegistryError extends Error {
  public override readonly name = 'ToolRegistryError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * One process's set of registered tools. `name` is the primary key — a tool declared
 * twice under the same name is refused rather than silently replaced, the same "an id is
 * never reused" reasoning `AgentRegistry` already applies to an agent's own `id`.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDeclaration>();

  /**
   * Validates and registers one tool declaration. Throws `ToolRegistryError` for a
   * structurally invalid candidate or a duplicate name — never registers partially.
   */
  register(candidate: unknown): ToolDeclaration {
    const result = ToolDeclaration.safeParse(candidate);
    if (!result.success) {
      throw new ToolRegistryError(
        `Tool declaration failed validation: ${result.error.message}`,
      );
    }
    const tool = result.data;
    if (this.tools.has(tool.name)) {
      throw new ToolRegistryError(
        `Tool "${tool.name}" is already registered. A name is never reused for a ` +
          'different tool.',
      );
    }
    this.tools.set(tool.name, tool);
    return tool;
  }

  get(name: string): ToolDeclaration | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): readonly ToolDeclaration[] {
    return [...this.tools.values()];
  }

  /** Whether a registered tool is classified `irreversible`. `false` for a name this
   * registry has never seen — an unregistered tool is `@infinite-ai/agents`'s own
   * "unknown reference" problem elsewhere (an agent contract naming a tool that was never
   * registered), not this predicate's job to flag. */
  isIrreversible(name: string): boolean {
    return this.tools.get(name)?.sideEffect === 'irreversible';
  }
}

/**
 * The startup validation pass itself: registers every candidate in order and throws on
 * the first one that fails — "a boot failure, not a warning," the same discipline
 * `bootAgentRegistry` already applies to agents.
 */
export function bootToolRegistry(candidates: readonly unknown[]): ToolRegistry {
  const registry = new ToolRegistry();
  for (const candidate of candidates) {
    registry.register(candidate);
  }
  return registry;
}

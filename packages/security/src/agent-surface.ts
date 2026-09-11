// Agent surface security — Stage 16 step 6.
//
// Two invariants, enforced here:
//
// 1. Tool allow-lists. An agent may only call tools in its declared allow-list. A request
//    for a tool not in the list is refused by the orchestrator before the agent turn even
//    starts — "can this agent call this tool?" is a yes/no fact, not a policy decision made
//    at runtime by the agent. This closes the "confused deputy" attack where a compromised
//    prompt tricks the agent into calling a tool it is not supposed to touch.
//
// 2. Output sanitisation contract. Before an agent's text output is rendered in the browser
//    or stored in the Brain, it must not contain patterns that indicate the output was
//    constructed as a navigation event, a data: URI, a javascript: URL, or an HTML tag.
//    This closes the most common prompt-injection-to-XSS pivot.
//
// Neither of these is a complete defence on its own. They layer on top of the PII guard,
// the guardrail plane, the append-only Brain, and the CSP. Defence-in-depth.

/** All tools available in the system. The orchestrator validates against this. */
export const ALL_TOOLS = [
  'brain.remember',
  'brain.retrieve',
  'brain.explain',
  'brain.forget',
  'policy.check',
  'policy.consent',
  'deident.tokenise',
  'deident.restore',
  'guardrails.check',
  'db.read',
  'db.write',
  'gateway.complete',
  'gateway.embed',
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

/**
 * Per-agent tool allow-lists.
 *
 * An agent not listed here has no tools at all — it operates as a pure text-in/text-out
 * completion, which is the correct baseline for agents that have not been explicitly
 * granted access to a tool.
 *
 * Keyed by agent ID (the canonical identifier used in packages/agents).
 */
export const AGENT_TOOL_ALLOWLISTS: Readonly<Record<string, readonly ToolName[]>> = {
  // Curriculum Engine — reads and writes the Brain, checks policy, embeds content.
  'CE-01': [
    'brain.remember',
    'brain.retrieve',
    'brain.explain',
    'policy.check',
    'gateway.embed',
  ],
  'CE-02': ['brain.retrieve', 'brain.explain', 'policy.check', 'gateway.embed'],
  'CE-03': [
    'brain.remember',
    'brain.retrieve',
    'brain.explain',
    'policy.check',
    'gateway.embed',
  ],
  'CE-04': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'CE-05': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'CE-06': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'CE-07': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'CE-08': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'CE-09': ['brain.retrieve', 'brain.explain'],
  // Support Analytics Centre — reads Brain and policy; no writes (HoD gate handles that).
  'AC-01': ['brain.retrieve', 'brain.explain', 'policy.check', 'deident.tokenise'],
  'AC-02': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'AC-03': ['brain.retrieve', 'brain.explain', 'policy.check', 'policy.consent'],
  'AC-04': ['brain.retrieve', 'policy.check'],
  'AC-05': ['brain.retrieve', 'brain.explain', 'policy.check'],
  // Toolbox — read-only; generates content for teacher review only.
  'TB-01': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'TB-02': ['brain.retrieve', 'brain.explain'],
  'TB-03': ['brain.retrieve', 'brain.explain'],
  'TB-04': ['brain.retrieve', 'brain.explain'],
  'TB-05': ['brain.retrieve', 'brain.explain'],
  'TB-06': ['brain.retrieve', 'brain.explain'],
  'TB-07': ['brain.retrieve', 'brain.explain'],
  'TB-08': ['brain.retrieve', 'brain.explain'],
  'TB-09': ['brain.retrieve', 'brain.explain'],
  'TB-10': ['brain.retrieve', 'brain.explain'],
  'TB-11': ['brain.retrieve', 'brain.explain'],
  // Teaching Analytics & PD Studio — read-only analytics.
  'PD-01': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'PD-02': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'PD-03': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'PD-04': ['brain.retrieve', 'brain.explain'],
  'PD-05': ['brain.retrieve', 'brain.explain'],
  'PD-06': ['brain.retrieve', 'brain.explain'],
  'PD-07': ['brain.retrieve', 'brain.explain'],
  'PD-08': ['brain.retrieve', 'brain.explain', 'policy.check'],
  // Learning Engine — reads Brain for context; writes promoted facts.
  'LE-01': ['brain.remember', 'brain.retrieve', 'brain.explain', 'policy.check'],
  'LE-02': ['brain.retrieve', 'brain.explain'],
  'LE-03': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'LE-04': ['brain.retrieve', 'brain.explain'],
  'LE-05': ['brain.retrieve', 'brain.explain'],
  'LE-06': ['brain.retrieve', 'brain.explain'],
  'LE-07': ['brain.retrieve', 'brain.explain', 'policy.check'],
  'LE-08': ['brain.retrieve', 'brain.explain'],
  'LE-09': ['brain.remember', 'brain.retrieve', 'brain.explain', 'policy.check'],
  // Data Warehouse — needs to write Brain and db; heavy consumer of deident.
  'DW-01': ['db.read', 'db.write', 'deident.tokenise', 'policy.check'],
  'DW-02': ['db.read', 'db.write', 'policy.check'],
  'DW-03': ['db.read', 'db.write', 'policy.consent', 'policy.check'],
  'DW-04': ['db.read', 'deident.tokenise', 'deident.restore'],
  'DW-05': ['db.read', 'db.write', 'policy.check'],
  'DW-06': ['brain.remember', 'brain.retrieve', 'db.read', 'deident.tokenise'],
  'DW-07': ['brain.retrieve', 'brain.explain', 'db.read'],
  'DW-08': ['brain.retrieve', 'brain.explain', 'db.read'],
};

/**
 * Returns whether the named tool is in the given agent's allow-list.
 *
 * Unknown agent IDs return `false` — an agent that has not been explicitly granted tools
 * has none.
 */
export function isToolAllowed(agentId: string, toolName: string): boolean {
  const allowed = AGENT_TOOL_ALLOWLISTS[agentId];
  if (allowed === undefined) return false;
  return (allowed as readonly string[]).includes(toolName);
}

// Patterns in agent output that indicate a prompt-injection-to-XSS attempt.
// The checks are intentionally broad — a false positive (blocking a legitimate piece of
// agent output that happens to contain a data: URI) is vastly preferable to a false
// negative (rendering a javascript: URI in the browser).
const UNSAFE_OUTPUT_PATTERNS: readonly RegExp[] = [
  /javascript:/i,
  /data:[^,]*base64/i,
  /<script[\s>]/i,
  /<iframe[\s>]/i,
  /on\w+\s*=/i, // onclick=, onload=, etc.
  /‮/, // Unicode right-to-left override — used in filename spoofing
];

/**
 * Returns true if the agent output does not contain any XSS/injection patterns.
 *
 * This is a last-resort check. It does not replace the guardrail plane; it catches
 * payloads that passed guardrails but contain rendering-level attacks.
 */
export function isOutputSafe(output: string): boolean {
  return UNSAFE_OUTPUT_PATTERNS.every((p) => !p.test(output));
}

/**
 * Returns the name of the first unsafe pattern found in the output, or `null` if safe.
 *
 * Used by the guardrail layer to produce a diagnostic message.
 */
export function findUnsafePattern(output: string): string | null {
  const PATTERN_NAMES = [
    'javascript_uri',
    'data_uri_base64',
    'script_tag',
    'iframe_tag',
    'inline_event_handler',
    'rtl_override',
  ];
  for (let i = 0; i < UNSAFE_OUTPUT_PATTERNS.length; i++) {
    if (UNSAFE_OUTPUT_PATTERNS[i]!.test(output)) return PATTERN_NAMES[i] ?? 'unknown';
  }
  return null;
}

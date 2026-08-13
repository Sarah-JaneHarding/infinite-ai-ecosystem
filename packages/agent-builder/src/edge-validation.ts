// Edge validation — Stage 19 (Visual Agent Builder).
//
// Before an edge is added to the canvas, this module checks that:
//   1. Both endpoint nodes exist.
//   2. Both endpoint ports exist on their respective node definitions.
//   3. The source port is an *output* and the target port is an *input*.
//   4. The port types are compatible (same type on both sides).
//   5. Adding the edge would not introduce a directed cycle.
//
// Cycle detection re-uses the same DFS the workflow module already has for
// validateWorkflow(); the difference is that here it runs incrementally on a
// *proposed* edge before it is committed, so the canvas never reaches an
// invalid state.

import {
  type WorkflowEdge,
  type WorkflowGraph,
  WorkflowValidationError,
} from './workflow.js';
import { getNodeDefinition } from './node-definitions.js';

export class EdgeValidationError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'EdgeValidationError';
  }
}

/**
 * Validates a proposed edge before it is added to the graph.
 *
 * Throws `EdgeValidationError` with a human-readable `reason` if the edge is
 * invalid. Returns void if the edge is safe to add.
 */
export function validateEdge(graph: WorkflowGraph, edge: WorkflowEdge): void {
  // ── 1. Source node must exist ─────────────────────────────────────────────
  const sourceNode = graph.nodes.find((n) => n.id === edge.sourceNodeId);
  if (sourceNode === undefined) {
    throw new EdgeValidationError(
      `Source node "${edge.sourceNodeId}" not found`,
      `The source node "${edge.sourceNodeId}" does not exist in this workflow.`,
    );
  }

  // ── 2. Target node must exist ─────────────────────────────────────────────
  const targetNode = graph.nodes.find((n) => n.id === edge.targetNodeId);
  if (targetNode === undefined) {
    throw new EdgeValidationError(
      `Target node "${edge.targetNodeId}" not found`,
      `The target node "${edge.targetNodeId}" does not exist in this workflow.`,
    );
  }

  // ── 3. Self-loop is always a cycle ────────────────────────────────────────
  if (edge.sourceNodeId === edge.targetNodeId) {
    throw new EdgeValidationError(
      'Self-loop detected',
      `A node cannot connect to itself ("${edge.sourceNodeId}").`,
    );
  }

  // ── 4. Port definitions ───────────────────────────────────────────────────
  const sourceDef = getNodeDefinition(sourceNode.type);
  const targetDef = getNodeDefinition(targetNode.type);

  if (sourceDef !== undefined) {
    const sourcePort = sourceDef.outputs.find((p) => p.name === edge.sourcePortName);
    if (sourcePort === undefined) {
      throw new EdgeValidationError(
        `Unknown output port "${edge.sourcePortName}" on "${sourceNode.type}"`,
        `Node type "${sourceNode.type}" has no output port named "${edge.sourcePortName}". ` +
          `Available outputs: ${sourceDef.outputs.map((p) => p.name).join(', ') || '(none)'}.`,
      );
    }

    if (targetDef !== undefined) {
      const targetPort = targetDef.inputs.find((p) => p.name === edge.targetPortName);
      if (targetPort === undefined) {
        throw new EdgeValidationError(
          `Unknown input port "${edge.targetPortName}" on "${targetNode.type}"`,
          `Node type "${targetNode.type}" has no input port named "${edge.targetPortName}". ` +
            `Available inputs: ${targetDef.inputs.map((p) => p.name).join(', ') || '(none)'}.`,
        );
      }

      // ── 5. Type compatibility ───────────────────────────────────────────
      if (sourcePort.type !== targetPort.type) {
        throw new EdgeValidationError(
          `Incompatible port types: "${sourcePort.type}" → "${targetPort.type}"`,
          `Output port "${edge.sourcePortName}" emits "${sourcePort.type}" but input port ` +
            `"${edge.targetPortName}" expects "${targetPort.type}".`,
        );
      }
    }
  }

  // ── 6. Cycle detection ────────────────────────────────────────────────────
  if (wouldCreateCycle(graph, edge)) {
    throw new EdgeValidationError(
      'Cycle detected',
      `Adding an edge from "${edge.sourceNodeId}" to "${edge.targetNodeId}" would create a ` +
        'directed cycle. Workflows must be acyclic (DAGs).',
    );
  }
}

/** Returns true if adding `edge` to `graph` would create a directed cycle. */
function wouldCreateCycle(graph: WorkflowGraph, edge: WorkflowEdge): boolean {
  // Build adjacency list including the proposed edge.
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const existing of graph.edges) {
    adj.get(existing.sourceNodeId)?.push(existing.targetNodeId);
  }
  // Add the proposed edge speculatively.
  adj.get(edge.sourceNodeId)?.push(edge.targetNodeId);

  // DFS from the target to see if we can reach the source.
  const visited = new Set<string>();
  function canReach(from: string, goal: string): boolean {
    if (from === goal) return true;
    visited.add(from);
    for (const next of adj.get(from) ?? []) {
      if (!visited.has(next) && canReach(next, goal)) return true;
    }
    return false;
  }

  return canReach(edge.targetNodeId, edge.sourceNodeId);
}

/**
 * Returns edges in the graph that connect to a node port that no longer exists
 * in the node-definition catalogue. Useful for detecting stale edges after a
 * workflow migration.
 */
export function findStaleEdges(
  graph: WorkflowGraph,
): Array<{ edge: WorkflowEdge; reason: string }> {
  const stale: Array<{ edge: WorkflowEdge; reason: string }> = [];

  for (const edge of graph.edges) {
    const sourceNode = graph.nodes.find((n) => n.id === edge.sourceNodeId);
    const targetNode = graph.nodes.find((n) => n.id === edge.targetNodeId);

    if (sourceNode === undefined) {
      stale.push({
        edge,
        reason: `Source node "${edge.sourceNodeId}" no longer exists.`,
      });
      continue;
    }
    if (targetNode === undefined) {
      stale.push({
        edge,
        reason: `Target node "${edge.targetNodeId}" no longer exists.`,
      });
      continue;
    }

    const sourceDef = getNodeDefinition(sourceNode.type);
    const targetDef = getNodeDefinition(targetNode.type);

    if (
      sourceDef !== undefined &&
      !sourceDef.outputs.some((p) => p.name === edge.sourcePortName)
    ) {
      stale.push({
        edge,
        reason: `Output port "${edge.sourcePortName}" no longer exists on "${sourceNode.type}".`,
      });
    }

    if (
      targetDef !== undefined &&
      !targetDef.inputs.some((p) => p.name === edge.targetPortName)
    ) {
      stale.push({
        edge,
        reason: `Input port "${edge.targetPortName}" no longer exists on "${targetNode.type}".`,
      });
    }
  }

  return stale;
}

// Re-export so callers don't need two imports.
export { WorkflowValidationError };

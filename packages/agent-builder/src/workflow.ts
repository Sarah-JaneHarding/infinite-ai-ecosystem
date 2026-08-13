// Visual workflow model — Stage 19 (Visual Agent Builder).
//
// A workflow is a DAG of typed nodes and directed edges. This module owns the
// design-time representation: nodes carry canvas positions and human-readable
// labels; edges connect named output ports on one node to named input ports on
// another. The execution-time equivalent lives in packages/orchestrator; see
// compile() in index.ts for the translation.

import { z } from 'zod';

// ─── Port types ───────────────────────────────────────────────────────────────

/** The data types that flow along edges between node ports. */
export const PortType = z.enum([
  'text', // unstructured string output (lesson plan body, etc.)
  'document', // structured artefact (lesson plan, assessment, report)
  'structured', // JSON-serialisable object without a fixed schema
  'signal', // a boolean trigger (gate approved, branch taken)
  'approval', // human approval record (approver, timestamp, decision)
]);
export type PortType = z.infer<typeof PortType>;

export const PortDefinition = z.object({
  name: z.string().min(1),
  type: PortType,
  required: z.boolean(),
  description: z.string().optional(),
});
export type PortDefinition = z.infer<typeof PortDefinition>;

// ─── Node ─────────────────────────────────────────────────────────────────────

export const NodeCategory = z.enum([
  'CE', // Curriculum Engine (MOD-01)
  'AC', // Support Analytics Centre (MOD-02)
  'DW', // Data Collection & Warehouse (MOD-03)
  'TB', // Teaching & Learning Toolbox (MOD-04)
  'PD', // Teaching Analytics & PD Studio (MOD-05)
  'LE', // Learning Engine
  'Branch', // Conditional branching
  'Gate', // Human-in-the-loop approval
  'Tool', // Database / API / file / LLM calls
  'Input', // Workflow input
  'Output', // Workflow output
]);
export type NodeCategory = z.infer<typeof NodeCategory>;

export const WorkflowNodePosition = z.object({
  x: z.number(),
  y: z.number(),
});
export type WorkflowNodePosition = z.infer<typeof WorkflowNodePosition>;

export const WorkflowNode = z.object({
  id: z.string().min(1),
  /** Reference to a NodeDefinition key (e.g. "CE-03", "Gate.approval"). */
  type: z.string().min(1),
  category: NodeCategory,
  label: z.string().min(1),
  position: WorkflowNodePosition,
  /** Free-form configuration specific to this node type (validated per NodeDefinition). */
  config: z.record(z.unknown()),
});
export type WorkflowNode = z.infer<typeof WorkflowNode>;

// ─── Edge ─────────────────────────────────────────────────────────────────────

export const WorkflowEdge = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  sourcePortName: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetPortName: z.string().min(1),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

// ─── Graph ────────────────────────────────────────────────────────────────────

export const WorkflowGraph = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  nodes: z.array(WorkflowNode),
  edges: z.array(WorkflowEdge),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;

// ─── Validation errors ────────────────────────────────────────────────────────

export class WorkflowValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

// ─── Graph operations ─────────────────────────────────────────────────────────

export function createWorkflow(
  id: string,
  name: string,
  description = '',
): WorkflowGraph {
  const now = new Date().toISOString();
  return {
    id,
    name,
    description,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addNode(graph: WorkflowGraph, node: WorkflowNode): WorkflowGraph {
  if (graph.nodes.some((n) => n.id === node.id)) {
    throw new WorkflowValidationError(`Duplicate node id "${node.id}"`, [
      `Node id "${node.id}" already exists in the workflow.`,
    ]);
  }
  return {
    ...graph,
    nodes: [...graph.nodes, node],
    updatedAt: new Date().toISOString(),
  };
}

export function removeNode(graph: WorkflowGraph, nodeId: string): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter(
      (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function addEdge(graph: WorkflowGraph, edge: WorkflowEdge): WorkflowGraph {
  if (graph.edges.some((e) => e.id === edge.id)) {
    throw new WorkflowValidationError(`Duplicate edge id "${edge.id}"`, [
      `Edge id "${edge.id}" already exists in the workflow.`,
    ]);
  }
  if (!graph.nodes.some((n) => n.id === edge.sourceNodeId)) {
    throw new WorkflowValidationError(`Source node "${edge.sourceNodeId}" not found`, [
      `Edge "${edge.id}" references unknown source node "${edge.sourceNodeId}".`,
    ]);
  }
  if (!graph.nodes.some((n) => n.id === edge.targetNodeId)) {
    throw new WorkflowValidationError(`Target node "${edge.targetNodeId}" not found`, [
      `Edge "${edge.id}" references unknown target node "${edge.targetNodeId}".`,
    ]);
  }
  return {
    ...graph,
    edges: [...graph.edges, edge],
    updatedAt: new Date().toISOString(),
  };
}

export function removeEdge(graph: WorkflowGraph, edgeId: string): WorkflowGraph {
  return {
    ...graph,
    edges: graph.edges.filter((e) => e.id !== edgeId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates the graph for structural correctness:
 * - All edge endpoints reference existing nodes.
 * - No duplicate node or edge ids.
 * - No directed cycles (the graph must be a DAG).
 *
 * Throws `WorkflowValidationError` if any issue is found.
 */
export function validateWorkflow(graph: WorkflowGraph): void {
  const issues: string[] = [];

  // Duplicate node ids
  const nodeIds = graph.nodes.map((n) => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size !== nodeIds.length) {
    issues.push('Workflow contains duplicate node ids.');
  }

  // Duplicate edge ids
  const edgeIds = graph.edges.map((e) => e.id);
  const uniqueEdgeIds = new Set(edgeIds);
  if (uniqueEdgeIds.size !== edgeIds.length) {
    issues.push('Workflow contains duplicate edge ids.');
  }

  // Dangling edge endpoints
  for (const edge of graph.edges) {
    if (!uniqueNodeIds.has(edge.sourceNodeId)) {
      issues.push(
        `Edge "${edge.id}": source node "${edge.sourceNodeId}" does not exist.`,
      );
    }
    if (!uniqueNodeIds.has(edge.targetNodeId)) {
      issues.push(
        `Edge "${edge.id}": target node "${edge.targetNodeId}" does not exist.`,
      );
    }
  }

  // Cycle detection via DFS
  if (hasCycle(graph)) {
    issues.push('Workflow graph contains a directed cycle — it must be a DAG.');
  }

  if (issues.length > 0) {
    throw new WorkflowValidationError(
      `Workflow "${graph.name}" failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
      issues,
    );
  }
}

/** Returns true if the graph contains a directed cycle. */
function hasCycle(graph: WorkflowGraph): boolean {
  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const targets = adj.get(edge.sourceNodeId);
    if (targets !== undefined) {
      targets.push(edge.targetNodeId);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }
  return false;
}

/** Serialises a workflow to a JSON string (round-trips through WorkflowGraph schema). */
export function exportWorkflow(graph: WorkflowGraph): string {
  return JSON.stringify(WorkflowGraph.parse(graph), null, 2);
}

/** Deserialises a workflow from a JSON string. Throws ZodError on malformed input. */
export function importWorkflow(json: string): WorkflowGraph {
  return WorkflowGraph.parse(JSON.parse(json));
}

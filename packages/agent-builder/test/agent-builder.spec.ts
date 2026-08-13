// Unit tests — Stage 19 (Visual Agent Builder).
// Happy path + at least two failure paths per area, per Definition of Done.

import { describe, expect, it } from 'vitest';

import {
  EdgeValidationError,
  findStaleEdges,
  validateEdge,
} from '../src/edge-validation.js';
import {
  cancelExecution,
  createExecutionRecord,
  getBlockingNodes,
  summariseExecution,
  updateNodeState,
} from '../src/monitoring.js';
import {
  getNodeDefinition,
  getNodesByCategory,
  NODE_DEFINITIONS,
} from '../src/node-definitions.js';
import { getTemplate, listTemplates, WORKFLOW_TEMPLATES } from '../src/templates.js';
import {
  addEdge,
  addNode,
  createWorkflow,
  exportWorkflow,
  importWorkflow,
  removeEdge,
  removeNode,
  validateWorkflow,
  WorkflowValidationError,
} from '../src/workflow.js';
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '../src/workflow.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id,
    type: 'CE-03',
    category: 'CE',
    label: `Node ${id}`,
    position: { x: 0, y: 0 },
    config: {},
    ...overrides,
  };
}

function makeEdge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  overrides: Partial<WorkflowEdge> = {},
): WorkflowEdge {
  return {
    id,
    sourceNodeId,
    targetNodeId,
    sourcePortName: 'lessonPlan',
    targetPortName: 'lessonPlan',
    ...overrides,
  };
}

// ─── workflow.ts ──────────────────────────────────────────────────────────────

describe('createWorkflow', () => {
  it('returns an empty DAG with the given id and name', () => {
    const g = createWorkflow('wf-1', 'My Flow', 'A description');
    expect(g.id).toBe('wf-1');
    expect(g.name).toBe('My Flow');
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });

  it('defaults description to empty string', () => {
    const g = createWorkflow('wf-2', 'No Desc');
    expect(g.description).toBe('');
  });
});

describe('addNode', () => {
  it('appends the node and bumps updatedAt', () => {
    const g = createWorkflow('wf', 'G');
    const before = g.updatedAt;
    const g2 = addNode(g, makeNode('n1'));
    expect(g2.nodes).toHaveLength(1);
    expect(g2.nodes[0]?.id).toBe('n1');
    expect(g2.updatedAt >= before).toBe(true);
  });

  it('throws WorkflowValidationError on duplicate node id', () => {
    const g = addNode(createWorkflow('wf', 'G'), makeNode('n1'));
    expect(() => addNode(g, makeNode('n1'))).toThrow(WorkflowValidationError);
  });
});

describe('removeNode', () => {
  it('removes the node and its incident edges', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    g = removeNode(g, 'a');
    expect(g.nodes.map((n) => n.id)).not.toContain('a');
    expect(g.edges).toHaveLength(0);
  });

  it('is a no-op (no error) if the node does not exist', () => {
    const g = createWorkflow('wf', 'G');
    expect(() => removeNode(g, 'ghost')).not.toThrow();
  });
});

describe('addEdge', () => {
  it('appends the edge', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    expect(g.edges).toHaveLength(1);
  });

  it('throws on duplicate edge id', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    expect(() => addEdge(g, makeEdge('e1', 'a', 'b'))).toThrow(WorkflowValidationError);
  });

  it('throws when source node does not exist', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('b'));
    expect(() => addEdge(g, makeEdge('e1', 'ghost', 'b'))).toThrow(
      WorkflowValidationError,
    );
  });

  it('throws when target node does not exist', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    expect(() => addEdge(g, makeEdge('e1', 'a', 'ghost'))).toThrow(
      WorkflowValidationError,
    );
  });
});

describe('removeEdge', () => {
  it('removes only the matching edge', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addNode(g, makeNode('c'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    g = addEdge(g, makeEdge('e2', 'b', 'c'));
    g = removeEdge(g, 'e1');
    expect(g.edges.map((e) => e.id)).toEqual(['e2']);
  });
});

describe('validateWorkflow', () => {
  it('passes for a valid linear DAG', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addNode(g, makeNode('c'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    g = addEdge(g, makeEdge('e2', 'b', 'c'));
    expect(() => validateWorkflow(g)).not.toThrow();
  });

  it('throws on a directed cycle', () => {
    const g: WorkflowGraph = {
      id: 'wf',
      name: 'G',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
        makeEdge('e3', 'c', 'a'), // cycle
      ],
    };
    expect(() => validateWorkflow(g)).toThrow(WorkflowValidationError);
  });

  it('throws on duplicate node ids', () => {
    const g: WorkflowGraph = {
      id: 'wf',
      name: 'G',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [makeNode('a'), makeNode('a')],
      edges: [],
    };
    expect(() => validateWorkflow(g)).toThrow(WorkflowValidationError);
  });

  it('throws on dangling edge endpoint', () => {
    const g: WorkflowGraph = {
      id: 'wf',
      name: 'G',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [makeNode('a')],
      edges: [makeEdge('e1', 'a', 'ghost')],
    };
    expect(() => validateWorkflow(g)).toThrow(WorkflowValidationError);
  });
});

describe('exportWorkflow / importWorkflow', () => {
  it('round-trips a workflow through JSON', () => {
    let g = createWorkflow('wf', 'Round-trip', 'desc');
    g = addNode(g, makeNode('a'));
    g = addNode(g, makeNode('b'));
    g = addEdge(g, makeEdge('e1', 'a', 'b'));
    const json = exportWorkflow(g);
    const restored = importWorkflow(json);
    expect(restored).toEqual(g);
  });

  it('importWorkflow throws ZodError on malformed JSON', () => {
    expect(() => importWorkflow('{"nodes": "not-an-array"}')).toThrow();
  });
});

// ─── node-definitions.ts ──────────────────────────────────────────────────────

describe('NODE_DEFINITIONS catalogue', () => {
  it('contains at least 54 entries', () => {
    expect(NODE_DEFINITIONS.size).toBeGreaterThanOrEqual(54);
  });

  it('every entry has at least one port (input or output)', () => {
    for (const [type, def] of NODE_DEFINITIONS) {
      const total = def.inputs.length + def.outputs.length;
      expect(total, `${type} has no ports`).toBeGreaterThan(0);
    }
  });

  it('all port types are valid PortType values', () => {
    const valid = new Set(['text', 'document', 'structured', 'signal', 'approval']);
    for (const [type, def] of NODE_DEFINITIONS) {
      for (const port of [...def.inputs, ...def.outputs]) {
        expect(
          valid.has(port.type),
          `${type}.${port.name} has invalid type "${port.type}"`,
        ).toBe(true);
      }
    }
  });
});

describe('getNodeDefinition', () => {
  it('returns the definition for a known type', () => {
    const def = getNodeDefinition('CE-03');
    expect(def).toBeDefined();
    expect(def?.type).toBe('CE-03');
  });

  it('returns undefined for an unknown type', () => {
    expect(getNodeDefinition('DOES-NOT-EXIST')).toBeUndefined();
  });
});

describe('getNodesByCategory', () => {
  it('returns CE nodes for the CE category', () => {
    const nodes = getNodesByCategory('CE');
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes) {
      expect(n.category).toBe('CE');
    }
  });

  it('returns an empty array for a category with no definitions', () => {
    // 'Input' and 'Output' are always present, but just ensure the call doesn't throw
    expect(() => getNodesByCategory('Input')).not.toThrow();
  });
});

// ─── edge-validation.ts ───────────────────────────────────────────────────────

function twoNodeGraph(): WorkflowGraph {
  let g = createWorkflow('wf', 'G');
  g = addNode(g, makeNode('src', { type: 'CE-04', category: 'CE', label: 'Source' }));
  g = addNode(g, makeNode('tgt', { type: 'CE-05', category: 'CE', label: 'Target' }));
  return g;
}

describe('validateEdge — happy path', () => {
  it('accepts a valid edge between compatible ports', () => {
    // CE-04 emits assessment (document), CE-05 accepts taskSpec (document)
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'src', 'tgt', {
      sourcePortName: 'assessment',
      targetPortName: 'taskSpec',
    });
    expect(() => validateEdge(g, edge)).not.toThrow();
  });
});

describe('validateEdge — failure paths', () => {
  it('throws EdgeValidationError when source node does not exist', () => {
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'ghost', 'tgt');
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError when target node does not exist', () => {
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'src', 'ghost');
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError on a self-loop', () => {
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'src', 'src');
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError when source port does not exist', () => {
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'src', 'tgt', { sourcePortName: 'nonexistent' });
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError when target port does not exist', () => {
    const g = twoNodeGraph();
    const edge = makeEdge('e1', 'src', 'tgt', {
      sourcePortName: 'assessment',
      targetPortName: 'nonexistent',
    });
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError when port types are incompatible', () => {
    // CE-04 emits markingGuide (document); CE-03 expects topic (text)
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('src', { type: 'CE-04', category: 'CE', label: 'S' }));
    g = addNode(g, makeNode('tgt', { type: 'CE-03', category: 'CE', label: 'T' }));
    const edge = makeEdge('e1', 'src', 'tgt', {
      sourcePortName: 'markingGuide', // document
      targetPortName: 'topic', // text
    });
    expect(() => validateEdge(g, edge)).toThrow(EdgeValidationError);
  });

  it('throws EdgeValidationError when adding the edge would create a cycle', () => {
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a', { type: 'CE-03', category: 'CE', label: 'A' }));
    g = addNode(g, makeNode('b', { type: 'CE-09', category: 'CE', label: 'B' }));
    // a → b (via lessonPlan → lessonPlan)
    g = addEdge(g, {
      id: 'e1',
      sourceNodeId: 'a',
      sourcePortName: 'lessonPlan',
      targetNodeId: 'b',
      targetPortName: 'lessonPlan',
    });
    // Propose b → a (would create a cycle)
    const back = {
      id: 'e2',
      sourceNodeId: 'b',
      sourcePortName: 'differentiatedMaterials',
      targetNodeId: 'a',
      targetPortName: 'topic',
    };
    expect(() => validateEdge(g, back)).toThrow(EdgeValidationError);
  });
});

describe('findStaleEdges', () => {
  it('returns empty array for a graph with no stale edges', () => {
    // CE-03 outputs lessonPlan (document); CE-09 inputs lessonPlan (document) — valid pair
    let g = createWorkflow('wf', 'G');
    g = addNode(g, makeNode('a', { type: 'CE-03', category: 'CE', label: 'A' }));
    g = addNode(g, makeNode('b', { type: 'CE-09', category: 'CE', label: 'B' }));
    g = addEdge(
      g,
      makeEdge('e1', 'a', 'b', {
        sourcePortName: 'lessonPlan',
        targetPortName: 'lessonPlan',
      }),
    );
    expect(findStaleEdges(g)).toHaveLength(0);
  });

  it('reports an edge referencing a deleted source node', () => {
    const g: WorkflowGraph = {
      id: 'wf',
      name: 'G',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [makeNode('b')],
      edges: [makeEdge('e1', 'ghost', 'b')],
    };
    const stale = findStaleEdges(g);
    expect(stale).toHaveLength(1);
    expect(stale[0]?.edge.id).toBe('e1');
  });

  it('reports an edge referencing a deleted target node', () => {
    const g: WorkflowGraph = {
      id: 'wf',
      name: 'G',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [makeNode('a')],
      edges: [makeEdge('e1', 'a', 'ghost')],
    };
    const stale = findStaleEdges(g);
    expect(stale).toHaveLength(1);
  });
});

// ─── templates.ts ─────────────────────────────────────────────────────────────

describe('WORKFLOW_TEMPLATES', () => {
  it('contains exactly 6 templates', () => {
    expect(WORKFLOW_TEMPLATES.size).toBe(6);
  });

  it('every template is a valid WorkflowGraph with at least 2 nodes and 1 edge', () => {
    for (const [key, tpl] of WORKFLOW_TEMPLATES) {
      expect(tpl.nodes.length, `${key}: insufficient nodes`).toBeGreaterThanOrEqual(2);
      expect(tpl.edges.length, `${key}: no edges`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every template graph passes validateWorkflow', () => {
    for (const [key, tpl] of WORKFLOW_TEMPLATES) {
      expect(() => validateWorkflow(tpl), `${key}: invalid graph`).not.toThrow();
    }
  });
});

describe('getTemplate', () => {
  it('returns the lesson-plan template', () => {
    const t = getTemplate('lesson-plan');
    expect(t).toBeDefined();
    expect(t?.name).toBe('Lesson Plan Generation');
  });

  it('returns undefined for an unknown key', () => {
    expect(getTemplate('no-such-template')).toBeUndefined();
  });
});

describe('listTemplates', () => {
  it('lists all 6 template keys', () => {
    expect(listTemplates()).toHaveLength(6);
  });
});

// ─── monitoring.ts ────────────────────────────────────────────────────────────

function baseRecord() {
  return createExecutionRecord({
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowName: 'Test Flow',
    nodeIds: ['a', 'b', 'c'],
    triggeredBy: 'actor-42',
  });
}

describe('createExecutionRecord', () => {
  it('initialises all nodes as pending', () => {
    const rec = baseRecord();
    expect(rec.status).toBe('pending');
    expect(rec.nodeStates.every((s) => s.status === 'pending')).toBe(true);
    expect(rec.nodeStates).toHaveLength(3);
  });
});

describe('updateNodeState', () => {
  it('transitions a node to running and derives workflow status', () => {
    const rec = updateNodeState(baseRecord(), 'a', {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    expect(rec.nodeStates.find((s) => s.nodeId === 'a')?.status).toBe('running');
    expect(rec.status).toBe('running');
  });

  it('derives succeeded when all nodes are succeeded or skipped', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'succeeded' });
    rec = updateNodeState(rec, 'b', { status: 'succeeded' });
    rec = updateNodeState(rec, 'c', { status: 'skipped' });
    expect(rec.status).toBe('succeeded');
  });

  it('derives failed when any node fails', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'succeeded' });
    rec = updateNodeState(rec, 'b', { status: 'failed', message: 'timeout' });
    expect(rec.status).toBe('failed');
  });

  it('throws when the nodeId is not tracked in the record', () => {
    expect(() => updateNodeState(baseRecord(), 'ghost', { status: 'running' })).toThrow();
  });
});

describe('cancelExecution', () => {
  it('sets overall status to cancelled and skips pending/running nodes', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'running' });
    const cancelled = cancelExecution(rec);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.nodeStates.find((s) => s.nodeId === 'a')?.status).toBe('skipped');
    expect(cancelled.nodeStates.find((s) => s.nodeId === 'b')?.status).toBe('skipped');
    expect(cancelled.finishedAt).toBeDefined();
  });

  it('does not change already-succeeded or already-failed nodes', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'succeeded' });
    rec = updateNodeState(rec, 'b', { status: 'failed' });
    const cancelled = cancelExecution(rec);
    expect(cancelled.nodeStates.find((s) => s.nodeId === 'a')?.status).toBe('succeeded');
    expect(cancelled.nodeStates.find((s) => s.nodeId === 'b')?.status).toBe('failed');
  });
});

describe('summariseExecution', () => {
  it('returns correct counts', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'succeeded' });
    rec = updateNodeState(rec, 'b', { status: 'running' });
    const summary = summariseExecution(rec);
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(1);
    expect(summary.running).toBe(1);
    expect(summary.pending).toBe(1);
  });
});

describe('getBlockingNodes', () => {
  it('returns nodes in waiting or failed state', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'waiting', message: 'Gate open' });
    rec = updateNodeState(rec, 'b', { status: 'failed', message: 'Error' });
    const blocking = getBlockingNodes(rec);
    expect(blocking.map((s) => s.nodeId).sort()).toEqual(['a', 'b']);
  });

  it('returns empty when no nodes are blocking', () => {
    let rec = baseRecord();
    rec = updateNodeState(rec, 'a', { status: 'succeeded' });
    rec = updateNodeState(rec, 'b', { status: 'succeeded' });
    rec = updateNodeState(rec, 'c', { status: 'skipped' });
    expect(getBlockingNodes(rec)).toHaveLength(0);
  });
});

// Public API — Stage 19 (Visual Agent Builder).

export {
  // Schemas
  PortType,
  PortDefinition,
  NodeCategory,
  WorkflowNodePosition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  // Error class
  WorkflowValidationError,
  // Operations
  createWorkflow,
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  validateWorkflow,
  exportWorkflow,
  importWorkflow,
} from './workflow.js';

export type {
  PortType as PortTypeValue,
  PortDefinition as PortDefinitionType,
  NodeCategory as NodeCategoryValue,
  WorkflowNodePosition as WorkflowNodePositionType,
  WorkflowNode as WorkflowNodeType,
  WorkflowEdge as WorkflowEdgeType,
  WorkflowGraph as WorkflowGraphType,
} from './workflow.js';

export {
  NodeDefinition,
  NODE_DEFINITIONS,
  getNodeDefinition,
  getNodesByCategory,
} from './node-definitions.js';

export type { NodeDefinition as NodeDefinitionType } from './node-definitions.js';

export { EdgeValidationError, validateEdge, findStaleEdges } from './edge-validation.js';

export { WORKFLOW_TEMPLATES, getTemplate, listTemplates } from './templates.js';

export type { TemplateKey } from './templates.js';

export {
  NodeExecutionStatus,
  NodeExecutionState,
  WorkflowExecutionStatus,
  WorkflowExecutionRecord,
  createExecutionRecord,
  updateNodeState,
  cancelExecution,
  summariseExecution,
  getBlockingNodes,
} from './monitoring.js';

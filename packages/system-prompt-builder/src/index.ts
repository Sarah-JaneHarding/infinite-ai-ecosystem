// Public API — Stage 21 (System Prompt Builder).

export { TenantPhase, TenantContext } from './tenant-context.js';

export type {
  TenantPhase as TenantPhaseValue,
  TenantContext as TenantContextType,
} from './tenant-context.js';

export { buildPlatformHeader, buildPlatformFooter } from './platform-rails.js';

export { RequestMeta, buildSystemMessage, buildChatRequest } from './builder.js';

export type {
  RequestMeta as RequestMetaType,
  AssembledSystemMessage,
} from './builder.js';

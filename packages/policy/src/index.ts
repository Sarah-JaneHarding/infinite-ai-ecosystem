// @infinite-ai/policy — RBAC, consent, purpose limitation, retention, impersonation.

export {
  Action,
  Actor,
  AuthorizationError,
  NEVER_GRANTED_VIA_RBAC,
  PERMISSIONS,
  PLATFORM_ROLES,
  Resource,
  ResourceType,
  Role,
  RoleGrant,
  Scope,
  assertAuthorized,
  authorize,
  type Decision,
  type DenialReason,
  type Permission,
} from './rbac.js';

export {
  APPROVAL_VALIDITY_HOURS,
  ImpersonationRequest,
  ImpersonationSession,
  MAX_DURATION_MINUTES,
  TenantApproval,
  endImpersonation,
  impersonationBanner,
  isSessionActive,
  startImpersonation,
  type StartRefusal,
  type StartResult,
} from './impersonation.js';

export const PACKAGE_NAME = '@infinite-ai/policy' as const;

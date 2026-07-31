// @infinite-ai/deident — de-identification and audited re-identification.

export {
  TOKEN_PATTERN,
  TOKEN_PREFIXES,
  TenantSalt,
  TokenisationError,
  isToken,
  tokenMatches,
  tokenise,
  type SubjectKind,
  type Token,
} from './tokenise.js';

export {
  containsDetectablePii,
  scrub,
  type Redaction,
  type RedactionKind,
  type ScrubResult,
  type TenantLexicon,
} from './scrub.js';

export const PACKAGE_NAME = '@infinite-ai/deident' as const;

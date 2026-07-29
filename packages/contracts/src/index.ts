// @infinite-ai/contracts — Zod schemas shared by the API, agents and UI. Purpose taxonomy lives here.
//
// Implemented in Stage 03. This stub exists so the workspace graph,
// the TypeScript project references and CI are real from Stage 00 onward.

export {
  DataCategory,
  PURPOSES,
  Purpose,
  definitionOf,
  permits,
  projectCategories,
  type CategoryProjection,
  type PurposeDefinition,
} from './popia/purpose.js';

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;

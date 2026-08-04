// @infinite-ai/brain — Infinite Brain memory service: L0-L4, retrieval path, write path.
//
// L0-L3's tables live in packages/db (Stage 05 step 1), the same way every other
// tenant-owned table does — this package builds the typed API and pipeline logic on top
// of them, starting with L4's Redis-shaped working memory, since it has no table of its
// own to add there.

export {
  InMemoryWorkingMemoryStore,
  promote,
  type WorkingMemoryStore,
  type WorkingMemorySummary,
} from './working-memory.js';

export const PACKAGE_NAME = '@infinite-ai/brain' as const;

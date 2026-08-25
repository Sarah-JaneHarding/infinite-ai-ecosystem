// The process entry point. Separate from `index.ts` so nothing that merely imports the
// package's exports (a test, another package) accidentally starts a BullMQ worker —
// `index.ts` only builds the pieces; this file is the one thing that runs them.

import { start } from './index.js';

await start();

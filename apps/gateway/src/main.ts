// The process entry point. Separate from `index.ts` so nothing that merely imports the
// package's exports (a test, another package) accidentally starts listening on a port —
// `index.ts` only builds a server; this file is the one thing that runs it.

import { loadGatewayEnv } from './config/env.js';
import { boot } from './index.js';

const server = boot();
server.listen(loadGatewayEnv().GATEWAY_PORT);

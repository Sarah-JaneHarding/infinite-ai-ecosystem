// A minimal HTTP surface for liveness/readiness probes — apps/worker has none otherwise,
// since it is a queue consumer, not a request handler. Found missing during a
// production-readiness audit: nothing (Kubernetes or otherwise) has a way to ask this
// process whether it is alive or ready to receive work.
//
// Two routes, deliberately not more:
//   /health — liveness. 200 the moment the HTTP server itself is accepting connections.
//             A process that can answer this is not deadlocked; it says nothing about
//             whether BullMQ has finished registering queues yet.
//   /ready  — readiness. 200 once every queue this host was told to register has been
//             registered, and until shutdown begins. The distinction matters for a
//             rolling deploy: a not-yet-ready pod should not be counted as available,
//             and a draining one should stop being counted before it stops accepting
//             new jobs, not after.

import { createServer, type Server, type ServerResponse } from 'node:http';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export interface WorkerHealthServer {
  readonly server: Server;
  /** Flips whether /ready reports 200. Call once boot completes, and again on shutdown. */
  setReady(ready: boolean): void;
  listen(port: number): void;
  close(): Promise<void>;
}

export function createWorkerHealthServer(): WorkerHealthServer {
  let ready = false;

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if (req.method === 'GET' && req.url === '/ready') {
      sendJson(res, ready ? 200 : 503, { ready });
      return;
    }
    sendJson(res, 404, {
      error: `No route for ${req.method ?? 'GET'} ${req.url ?? '/'}.`,
    });
  });

  return {
    server,
    setReady(next: boolean): void {
      ready = next;
    },
    listen(port: number): void {
      server.listen(port);
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

// apps/worker's only HTTP surface — a liveness/readiness probe, since it is a queue
// consumer with no other request handler. Uses a real listening socket on an
// OS-assigned port rather than mocking node:http, the same "exercise the real thing"
// preference the rest of this suite already follows.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createWorkerHealthServer,
  type WorkerHealthServer,
} from '../src/health-server.js';

let health: WorkerHealthServer;
let baseUrl: string;

beforeEach(async () => {
  health = createWorkerHealthServer();
  await new Promise<void>((resolve) => {
    health.server.listen(0, resolve);
  });
  const address = health.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected a bound TCP address');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await health.close();
});

describe('createWorkerHealthServer', () => {
  it('/health reports ok as soon as the server is listening', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('/ready reports 503 until setReady(true) is called', async () => {
    const before = await fetch(`${baseUrl}/ready`);
    expect(before.status).toBe(503);
    expect(await before.json()).toEqual({ ready: false });

    health.setReady(true);

    const after = await fetch(`${baseUrl}/ready`);
    expect(after.status).toBe(200);
    expect(await after.json()).toEqual({ ready: true });
  });

  it('/ready reports 503 again once setReady(false) is called', async () => {
    health.setReady(true);
    health.setReady(false);

    const response = await fetch(`${baseUrl}/ready`);
    expect(response.status).toBe(503);
  });

  it('404s any other route', async () => {
    const response = await fetch(`${baseUrl}/anything-else`);
    expect(response.status).toBe(404);
  });
});

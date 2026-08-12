/**
 * k6 spike test — term-start ingest and Sunday-evening lesson-planning (Stage 18 §2).
 *
 * Two spike scenarios:
 *   A. Term-start ingest spike: all educators across all schools submit ATP and
 *      curriculum documents at the start of a term.  Represented as a sharp ramp
 *      to 600 VU (4× peak) for 5 minutes, then immediate drop.
 *
 *   B. Sunday-evening lesson-planning: educators batch-generate lesson plans for
 *      the week ahead on Sunday evenings.  Represented as a sustained burst at
 *      300 VU for 20 minutes (2× peak, sustained longer than a spike).
 *
 * Prerequisites (OQ-017): same as k6-peak.js — needs a live staging environment.
 *
 * Run: k6 run scripts/load/k6-spike.js
 * Select scenario with SCENARIO=term_start or SCENARIO=sunday_evening
 */

// @ts-check
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const artefactLatency = new Trend('artefact_generation_latency', true);

const SCENARIO = __ENV.SCENARIO || 'term_start';

const termStartOptions = {
  stages: [
    { duration: '30s', target: 600 }, // sharp ramp to 4× peak
    { duration: '5m', target: 600 }, // sustain the spike
    { duration: '30s', target: 0 }, // immediate drop
  ],
};

const sundayEveningOptions = {
  stages: [
    { duration: '5m', target: 300 }, // ramp to 2× peak
    { duration: '20m', target: 300 }, // sustained burst (lesson-plan window)
    { duration: '2m', target: 0 }, // ramp down
  ],
};

export const options = {
  ...(SCENARIO === 'sunday_evening' ? sundayEveningOptions : termStartOptions),
  thresholds: {
    // Under a spike, allow p95 to stretch to 15 s (2× the normal SLO).
    // If p99 exceeds 30 s the spike is degrading to a functional outage.
    artefact_generation_latency: ['p(95)<15000', 'p(99)<30000'],
    // Allow higher error rate during a spike but never exceed 5 %.
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const GATEWAY_TOKEN = __ENV.GATEWAY_TOKEN || 'dev-token';
const TENANT_ID = __ENV.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${GATEWAY_TOKEN}`,
  'X-Tenant-Id': TENANT_ID,
};

/**
 * Term-start spike: submit a large curriculum document for ingest.
 * This exercises the data-plane write path and Brain constitution updates.
 */
function ingestCurriculumDocument() {
  const payload = JSON.stringify({
    agentId: 'CE-01',
    tenantId: TENANT_ID,
    input: {
      gradeId: '00000000-0000-0000-0000-000000000010',
      subjectId: '00000000-0000-0000-0000-000000000020',
      atpDocumentRef: `atp-term-${Date.now()}`,
      deidentified: true,
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/v1/generate`, payload, { headers, timeout: '60s' });
  const elapsed = Date.now() - start;

  const ok = check(res, {
    'ingest: status 200 or 202': (r) => r.status === 200 || r.status === 202,
  });

  errorRate.add(!ok);
  artefactLatency.add(elapsed);
}

/**
 * Sunday-evening spike: batch generate lesson plans for the week.
 * Five lesson plans per session (Mon–Fri), all for the same educator.
 */
function batchGenerateLessonPlans() {
  const topics = [
    'Fractions — introduction',
    'Fractions — comparing',
    'Fractions — adding',
    'Fractions — subtracting',
    'Fractions — word problems',
  ];

  for (const topic of topics) {
    const payload = JSON.stringify({
      agentId: 'CE-03',
      tenantId: TENANT_ID,
      input: {
        gradeId: '00000000-0000-0000-0000-000000000010',
        subjectId: '00000000-0000-0000-0000-000000000020',
        termId: '00000000-0000-0000-0000-000000000030',
        topic,
        duration: 60,
        deidentified: true,
      },
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/v1/generate`, payload, {
      headers,
      timeout: '30s',
    });
    const elapsed = Date.now() - start;

    const ok = check(res, {
      'lesson plan: status 200': (r) => r.status === 200,
    });

    errorRate.add(!ok);
    artefactLatency.add(elapsed);

    // Brief pause between plans within the same session (realistic pacing).
    sleep(1);
  }
}

export default function () {
  if (SCENARIO === 'sunday_evening') {
    batchGenerateLessonPlans();
    sleep(Math.random() * 30 + 30); // 30–60 s between batch sessions
  } else {
    ingestCurriculumDocument();
    sleep(Math.random() * 5 + 2); // 2–7 s between term-start ingest requests
  }
}

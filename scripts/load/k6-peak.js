/**
 * k6 load test — 3× expected peak (Stage 18 §2).
 *
 * Expected peak: 150 concurrent learners (Starter tier maximum).
 * 3× peak: 450 virtual users.
 *
 * Scenario: a normal school day — educators creating artefacts in the morning,
 * learners receiving generated content in the afternoon.  This represents the
 * sustained peak, not a spike.
 *
 * Prerequisites (OQ-017):
 *   - A running gateway at BASE_URL (staging or production-like environment).
 *   - A valid GATEWAY_TOKEN for the `app_rw` role.
 *   - Seed data for at least one school with 150 learners.
 *
 * Run: k6 run scripts/load/k6-peak.js
 * Or:  BASE_URL=https://staging.example.com GATEWAY_TOKEN=xxx k6 run scripts/load/k6-peak.js
 */

// @ts-check
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const artefactLatency = new Trend('artefact_generation_latency', true);

export const options = {
  stages: [
    { duration: '2m', target: 150 }, // ramp up to expected peak (150 VU)
    { duration: '5m', target: 150 }, // hold at expected peak
    { duration: '2m', target: 450 }, // ramp up to 3× peak
    { duration: '10m', target: 450 }, // hold at 3× peak for 10 minutes
    { duration: '2m', target: 0 }, // ramp down
  ],
  thresholds: {
    // SLO: p95 latency for artefact generation < 8 s
    artefact_generation_latency: ['p(95)<8000'],
    // SLO: error rate < 1 %
    errors: ['rate<0.01'],
    // SLO: overall HTTP request p99 < 2 s (non-generation requests)
    http_req_duration: ['p(99)<2000'],
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
 * Simulates an educator creating a lesson plan artefact (most common operation).
 */
function generateLessonPlan() {
  const payload = JSON.stringify({
    agentId: 'CE-03',
    tenantId: TENANT_ID,
    input: {
      gradeId: '00000000-0000-0000-0000-000000000010',
      subjectId: '00000000-0000-0000-0000-000000000020',
      termId: '00000000-0000-0000-0000-000000000030',
      topic: 'Fractions — comparing and ordering',
      duration: 60,
      deidentified: true,
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/v1/generate`, payload, { headers, timeout: '30s' });
  const elapsed = Date.now() - start;

  const ok = check(res, {
    'lesson plan: status 200': (r) => r.status === 200,
    'lesson plan: has output': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok' && typeof body.result === 'object';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);
  artefactLatency.add(elapsed);
}

/**
 * Simulates a learner reading a generated explanation (cheaper operation).
 */
function readBrainNode() {
  const res = http.get(`${BASE_URL}/v1/brain/nodes?tenantId=${TENANT_ID}&limit=10`, {
    headers,
    timeout: '5s',
  });

  const ok = check(res, {
    'brain read: status 200': (r) => r.status === 200,
  });

  errorRate.add(!ok);
}

export default function () {
  // 70 % of virtual users simulate educators generating artefacts.
  // 30 % simulate learner read operations (cheaper, faster).
  if (Math.random() < 0.7) {
    generateLessonPlan();
    sleep(Math.random() * 5 + 5); // 5–10 s between educator requests (realistic pacing)
  } else {
    readBrainNode();
    sleep(Math.random() * 2 + 1); // 1–3 s between learner reads
  }
}

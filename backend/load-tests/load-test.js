import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const API_URL = __ENV.API_URL || 'http://localhost:8080/api';

const secretCreations = new Counter('secret_creations');
const secretRetrievals = new Counter('secret_retrievals');
const secretBurns = new Counter('secret_burns');
const failedRequests = new Counter('failed_requests');
const requestDuration = new Trend('request_duration');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
    error_rate: ['rate<0.05'],
  },
};

function createSecret() {
  const payload = JSON.stringify({
    ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0LWF0LWJlLTEyOC1iaXRz',
    iv: 'dGVzdC1pdjEyMzQ1Njc4OTA=',
    salt: 'dGVzdC1zYWx0LTEyMzQ1Njc4OTA=',
    expires_in: 3600,
    burn_after_read: true,
  });

  const start = Date.now();
  const response = http.post(`${API_URL}/secrets`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const duration = Date.now() - start;

  requestDuration.add(duration);

  const success = check(response, {
    'create secret status is 201': (r) => r.status === 201,
    'create secret has id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id && body.id.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    secretCreations.add(1);
    try {
      return JSON.parse(response.body).id;
    } catch {
      return null;
    }
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`Create secret failed: ${response.status} - ${response.body}`);
    return null;
  }
}

function retrieveSecret(secretId) {
  const start = Date.now();
  const response = http.get(`${API_URL}/secrets/${secretId}`);
  const duration = Date.now() - start;

  requestDuration.add(duration);

  const success = check(response, {
    'retrieve secret status is 200': (r) => r.status === 200,
    'retrieve secret has ciphertext': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ciphertext && body.ciphertext.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    secretRetrievals.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`Retrieve secret failed: ${response.status} - ${response.body}`);
  }
}

function burnSecret(secretId) {
  const start = Date.now();
  const response = http.del(`${API_URL}/secrets/${secretId}`);
  const duration = Date.now() - start;

  requestDuration.add(duration);

  const success = check(response, {
    'burn secret status is 204': (r) => r.status === 204,
  });

  if (success) {
    secretBurns.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
    console.log(`Burn secret failed: ${response.status} - ${response.body}`);
  }
}

function healthCheck() {
  const start = Date.now();
  const response = http.get(`${API_URL}/health`);
  const duration = Date.now() - start;

  requestDuration.add(duration);

  check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check returns healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy' || body.status === 'degraded';
      } catch {
        return false;
      }
    },
  });
}

function readinessCheck() {
  const start = Date.now();
  const response = http.get(`${API_URL}/health/ready`);
  const duration = Date.now() - start;

  requestDuration.add(duration);

  check(response, {
    'readiness check status is 200': (r) => r.status === 200,
  });
}

function metricsCheck() {
  const start = Date.now();
  const response = http.get(`${API_URL}/metrics`);
  const duration = Date.now() - start;

  requestDuration.add(duration);

  check(response, {
    'metrics check status is 200': (r) => r.status === 200,
  });
}

export default function () {
  group('Health Checks', () => {
    healthCheck();
    readinessCheck();
    metricsCheck();
  });

  sleep(1);

  group('Secret Creation', () => {
    const secretId = createSecret();

    if (secretId) {
      sleep(1);

      group('Secret Retrieval', () => {
        retrieveSecret(secretId);
      });
    }
  });

  sleep(2);

  group('Secret Creation with Burn', () => {
    const secretId = createSecret();

    if (secretId) {
      sleep(0.5);

      group('Secret Burn', () => {
        burnSecret(secretId);
      });
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      metrics: {
        secret_creations: data.metrics.secret_creations ? data.metrics.secret_creations.values.count : 0,
        secret_retrievals: data.metrics.secret_retrievals ? data.metrics.secret_retrievals.values.count : 0,
        secret_burns: data.metrics.secret_burns ? data.metrics.secret_burns.values.count : 0,
        failed_requests: data.metrics.failed_requests ? data.metrics.failed_requests.values.count : 0,
        error_rate: data.metrics.error_rate ? data.metrics.error_rate.values.rate : 0,
        avg_request_duration: data.metrics.request_duration ? data.metrics.request_duration.values.avg : 0,
        p95_request_duration: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0,
      },
      checks: {
        passed: data.metrics.checks ? data.metrics.checks.values.passes : 0,
        failed: data.metrics.checks ? data.metrics.checks.values.fails : 0,
      },
      http_reqs: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
      http_req_failed: data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0,
    }, null, 2),
  };
}

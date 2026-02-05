import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:8080/api';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 2000 },
    { duration: '1m', target: 2000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const payload = JSON.stringify({
    ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
    iv: 'dGVzdC1pdg==',
    salt: 'dGVzdC1zYWx0',
    expires_in: 3600,
  });

  const response = http.post(`${API_URL}/secrets`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'secret created successfully': (r) => r.status === 201,
  });

  sleep(0.1);
}

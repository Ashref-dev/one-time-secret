import { test, expect } from '@playwright/test';

test.describe('Health Endpoints', () => {
  const API_URL = process.env.VITE_API_URL || 'http://localhost:8080/api';

  test('health check should return healthy status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
  });

  test('readiness probe should return ready status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health/ready`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ready');
  });

  test('liveness probe should return alive status', async ({ request }) => {
    const response = await request.get(`${API_URL}/health/live`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('alive');
  });

  test('metrics endpoint should return metrics', async ({ request }) => {
    const response = await request.get(`${API_URL}/metrics`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.uptime).toBeDefined();
    expect(body.request_count_total).toBeDefined();
    expect(body.go_routines).toBeDefined();
    expect(body.memory_mb).toBeDefined();
  });
});

test.describe('API Endpoints', () => {
  const API_URL = process.env.VITE_API_URL || 'http://localhost:8080/api';

  test('should create a secret', async ({ request }) => {
    const response = await request.post(`${API_URL}/secrets`, {
      data: {
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        iv: 'dGVzdC1pdg==',
        salt: 'dGVzdC1zYWx0',
        expires_in: 3600,
        burn_after_read: true,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  test('should return 400 for invalid request body', async ({ request }) => {
    const response = await request.post(`${API_URL}/secrets`, {
      data: 'invalid json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should return 400 for missing required fields', async ({ request }) => {
    const response = await request.post(`${API_URL}/secrets`, {
      data: {
        expires_in: 3600,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should return 400 for invalid TTL', async ({ request }) => {
    const response = await request.post(`${API_URL}/secrets`, {
      data: {
        ciphertext: 'dGVzdA==',
        iv: 'dGVzdA==',
        expires_in: 999999,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should retrieve and delete a secret (one-time read)', async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/secrets`, {
      data: {
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        iv: 'dGVzdC1pdg==',
        salt: 'dGVzdC1zYWx0',
        expires_in: 3600,
        burn_after_read: true,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { id } = await createResponse.json();

    const getResponse = await request.get(`${API_URL}/secrets/${id}`);
    expect(getResponse.ok()).toBeTruthy();
    
    const body = await getResponse.json();
    expect(body.ciphertext).toBeDefined();
    expect(body.iv).toBeDefined();

    const secondGetResponse = await request.get(`${API_URL}/secrets/${id}`);
    expect(secondGetResponse.status()).toBe(404);
  });

  test('should return 404 for non-existent secret', async ({ request }) => {
    const response = await request.get(`${API_URL}/secrets/non-existent-id-12345`);
    
    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should burn a secret manually', async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/secrets`, {
      data: {
        ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
        iv: 'dGVzdC1pdg==',
        expires_in: 3600,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { id } = await createResponse.json();

    const burnResponse = await request.delete(`${API_URL}/secrets/${id}`);
    expect(burnResponse.status()).toBe(204);

    const getResponse = await request.get(`${API_URL}/secrets/${id}`);
    expect(getResponse.status()).toBe(404);
  });

  test('should return 404 when burning non-existent secret', async ({ request }) => {
    const response = await request.delete(`${API_URL}/secrets/non-existent-id-12345`);
    
    expect(response.status()).toBe(404);
  });
});

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { healthRoutes } from './health.js';

describe('GET /health', () => {
  it('returns status and checks array', async () => {
    const app = Fastify();
    await app.register(healthRoutes);

    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();

    // Upstream services won't be reachable in test, so expect degraded
    expect(res.statusCode).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks).toHaveLength(3);
    expect(body.timestamp).toBeDefined();
  });
});

import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
}

async function checkService(name: string, url: string): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      service: name,
      status: res.ok ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - start,
    };
  } catch {
    return { service: name, status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    const checks = await Promise.all([
      checkService('mystweaver', `${config.MYSTWEAVER_API_URL}/health`),
      checkService('room404', `${config.ROOM404_API_URL}/health`),
      checkService('verika', `${config.VERIKA_API_URL}/health`),
      checkService('grafana', `${config.GRAFANA_URL}/api/health`),
    ]);

    const allHealthy = checks.every((c) => c.status === 'healthy');
    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
};

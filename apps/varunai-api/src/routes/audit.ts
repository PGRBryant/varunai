import type { FastifyPluginAsync } from 'fastify';
import { fetchAuditLog } from '../clients/mystweaver.js';

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const poll = async (): Promise<void> => {
      try {
        const entries = await fetchAuditLog('default');
        for (const entry of entries) {
          reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
        }
      } catch {
        // Silent failure — SSE reconnects automatically
      }
    };

    await poll();
    const interval = setInterval(() => void poll(), 5000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });

  app.get('/experiments/active', async (_request, reply) => {
    try {
      const { fetchExperiments } = await import('../clients/mystweaver.js');
      const experiments = await fetchExperiments();
      return reply.send(experiments);
    } catch (err) {
      app.log.error(err, 'Failed to fetch experiments');
      return reply.status(502).send({ error: 'Failed to fetch experiments' });
    }
  });
};

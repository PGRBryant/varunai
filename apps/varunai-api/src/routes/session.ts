import type { FastifyPluginAsync } from 'fastify';
import { fetchCurrentSession } from '../clients/room404.js';

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  // TODO(verika): Add requireCapability('session.read') once Verika is live
  app.get('/current', async (_request, reply) => {
    try {
      const session = await fetchCurrentSession();
      return reply.send(session);
    } catch (err) {
      app.log.error(err, 'Failed to fetch session');
      return reply.status(502).send({ error: 'Failed to fetch session from Room 404' });
    }
  });
};

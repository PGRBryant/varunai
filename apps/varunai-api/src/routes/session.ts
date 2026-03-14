import type { FastifyPluginAsync } from 'fastify';
import { fetchCurrentSession, fetchSession, fetchSessionByCode } from '../clients/room404.js';

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  // TODO(verika): Add requireCapability('session.read') once Verika is live
  app.get('/current', async (_request, reply) => {
    try {
      const session = await fetchCurrentSession();
      if (!session) {
        return reply.send({ session: null, message: 'No active session' });
      }
      return reply.send(session);
    } catch (err) {
      app.log.error(err, 'Failed to fetch session');
      return reply.status(502).send({ error: 'Failed to fetch session from Room 404' });
    }
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const session = await fetchSession(request.params.id);
      return reply.send(session);
    } catch (err) {
      app.log.error(err, 'Failed to fetch session');
      return reply.status(502).send({ error: 'Failed to fetch session from Room 404' });
    }
  });

  app.get<{ Params: { code: string } }>('/code/:code', async (request, reply) => {
    try {
      const session = await fetchSessionByCode(request.params.code);
      return reply.send(session);
    } catch (err) {
      app.log.error(err, 'Failed to fetch session');
      return reply.status(502).send({ error: 'Failed to fetch session from Room 404' });
    }
  });
};

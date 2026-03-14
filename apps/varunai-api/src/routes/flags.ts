import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { fetchFlags, patchFlag } from '../clients/mystweaver.js';
import { broadcast } from './ws.js';

const patchSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  reason: z.string().optional(),
});

export const flagRoutes: FastifyPluginAsync = async (app) => {
  app.get('/current', async (_request, reply) => {
    try {
      const flags = await fetchFlags();
      return reply.send(flags);
    } catch (err) {
      app.log.error(err, 'Failed to fetch flags');
      return reply.status(502).send({ error: 'Failed to fetch flags from MystWeaver' });
    }
  });

  app.patch<{ Params: { key: string } }>('/:key', async (request, reply) => {
    const { key } = request.params;
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }

    try {
      const result = await patchFlag(key, parsed.data.value, parsed.data.reason ?? '');
      broadcast({
        type: 'FLAG_CHANGED',
        key,
        from: 'unknown',
        to: result.newValue,
        changedBy: 'presenter',
        traceId: result.traceId,
      });
      return reply.send(result);
    } catch (err) {
      app.log.error(err, 'Failed to patch flag');
      return reply.status(502).send({ error: 'Failed to update flag in MystWeaver' });
    }
  });
};
